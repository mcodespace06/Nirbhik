import { prisma } from '../../lib/prisma';
import { Priority, ComplaintStatus, AlertType, Role } from '@prisma/client';
import { mailer } from '../notifications/mailer';
import { notificationService } from '../notifications/notifications.service';

export interface SlaRule {
  priority: Priority;
  firstResponseHours: number;
  resolutionHours: number;
}

export const DEFAULT_SLA_POLICIES: Record<Priority, SlaRule> = {
  [Priority.CRITICAL]: { priority: Priority.CRITICAL, firstResponseHours: 2, resolutionHours: 24 },
  [Priority.HIGH]: { priority: Priority.HIGH, firstResponseHours: 24, resolutionHours: 72 },
  [Priority.MEDIUM]: { priority: Priority.MEDIUM, firstResponseHours: 72, resolutionHours: 240 },
  [Priority.LOW]: { priority: Priority.LOW, firstResponseHours: 168, resolutionHours: 720 },
};

export interface SlaBreachResult {
  complaintId: string;
  pseudonym: string;
  title: string;
  priority: Priority;
  breachType: 'FIRST_RESPONSE' | 'RESOLUTION';
  hoursElapsed: number;
  allowedHours: number;
  assignedTo?: string | null;
}

export interface SlaCheckReport {
  timestamp: string;
  evaluatedCasesCount: number;
  breachedCasesCount: number;
  escalatedCasesCount: number;
  breaches: SlaBreachResult[];
}

/**
 * Retrieves SLA policies from DB or defaults if DB table is unpopulated.
 */
export async function getSlaPolicies(): Promise<Record<Priority, SlaRule>> {
  try {
    const dbPolicies = await prisma.slaPolicy.findMany();
    if (dbPolicies && dbPolicies.length > 0) {
      const map: Partial<Record<Priority, SlaRule>> = {};
      for (const p of dbPolicies) {
        map[p.priority] = {
          priority: p.priority,
          firstResponseHours: p.firstResponseHours,
          resolutionHours: p.resolutionHours,
        };
      }
      return {
        ...DEFAULT_SLA_POLICIES,
        ...map,
      };
    }
  } catch (err) {
    // Non-fatal fallback to defaults
  }
  return DEFAULT_SLA_POLICIES;
}

/**
 * Scans open complaints, checks for first-response and resolution SLA breaches,
 * auto-escalates status if needed, creates risk alerts and issues notifications.
 */
export async function checkAndEscalateSLAs(): Promise<SlaCheckReport> {
  const policies = await getSlaPolicies();
  const now = new Date();

  // Find all active, non-finalized complaints
  const openComplaints = await prisma.complaint.findMany({
    where: {
      status: {
        notIn: [
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ],
      },
    },
    include: {
      events: true,
      messages: true,
      riskAlerts: true,
    },
  });

  const breaches: SlaBreachResult[] = [];
  let escalatedCount = 0;

  for (const complaint of openComplaints) {
    const policy = policies[complaint.priority] || DEFAULT_SLA_POLICIES[Priority.MEDIUM];
    const hoursElapsed = (now.getTime() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60);

    // Check first-response breach:
    // A first response is defined as any status change past SUBMITTED or an admin message
    const hasAdminMessage = complaint.messages.some((m) => m.sender === 'ADMIN');
    const hasStatusMoved = complaint.status !== ComplaintStatus.SUBMITTED;
    const hasFirstResponse = hasAdminMessage || hasStatusMoved;

    let isBreached = false;
    let breachType: 'FIRST_RESPONSE' | 'RESOLUTION' = 'RESOLUTION';
    let allowedHours = policy.resolutionHours;

    if (!hasFirstResponse && hoursElapsed > policy.firstResponseHours) {
      isBreached = true;
      breachType = 'FIRST_RESPONSE';
      allowedHours = policy.firstResponseHours;
    } else if (hoursElapsed > policy.resolutionHours) {
      isBreached = true;
      breachType = 'RESOLUTION';
      allowedHours = policy.resolutionHours;
    }

    if (isBreached) {
      breaches.push({
        complaintId: complaint.id,
        pseudonym: complaint.pseudonym,
        title: complaint.title,
        priority: complaint.priority,
        breachType,
        hoursElapsed: Math.round(hoursElapsed * 10) / 10,
        allowedHours,
        assignedTo: complaint.assignedTo,
      });

      // 1. Escalate status if not already escalated
      let statusUpdated = false;
      if (complaint.status !== ComplaintStatus.ESCALATED) {
        try {
          await prisma.complaint.update({
            where: { id: complaint.id },
            data: { status: ComplaintStatus.ESCALATED },
          });

          await prisma.complaintEvent.create({
            data: {
              complaintId: complaint.id,
              type: 'ESCALATED',
              actorRole: Role.SUPER_ADMIN,
              payload: {
                reason: `Automated SLA Escalation: ${breachType} SLA exceeded (${Math.round(hoursElapsed)}h elapsed vs ${allowedHours}h target)`,
                breachType,
                hoursElapsed: Math.round(hoursElapsed),
                allowedHours,
              },
            },
          });
          statusUpdated = true;
          escalatedCount++;
        } catch (err) {
          console.error(`[SLA Escalation Error] Failed to update complaint ${complaint.id}:`, err);
        }
      }

      // 2. Create RiskAlert for SLA_BREACH if not already created for this breach
      const existingAlert = complaint.riskAlerts.find(
        (a) => a.type === AlertType.SLA_BREACH && a.status === 'OPEN'
      );

      if (!existingAlert) {
        try {
          await prisma.riskAlert.create({
            data: {
              type: AlertType.SLA_BREACH,
              complaintId: complaint.id,
              message: `Institutional SLA Breach: [${complaint.priority}] Case "${complaint.title}" (${complaint.pseudonym}) exceeded ${breachType} target (${Math.round(hoursElapsed)}h elapsed / ${allowedHours}h allowed).`,
              recommendedActions: [
                'Reassign to senior grievance officer immediately',
                'Initiate priority outreach with complainant',
                'Schedule direct review at next disciplinary board convening',
              ],
            },
          });
        } catch (err) {
          console.error(`[SLA Escalation Alert Error] Failed to create risk alert for ${complaint.id}:`, err);
        }
      }

      // 3. Issue in-app and email notifications
      try {
        // Find assigned admin or all Admins
        const adminRecipients = await prisma.user.findMany({
          where: {
            role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
            status: 'ACTIVE',
          },
          select: { id: true, collegeEmail: true, role: true },
        });

        for (const admin of adminRecipients) {
          await notificationService.createNotification({
            userId: admin.id,
            channel: 'IN_APP',
            type: 'SLA_BREACH',
            payload: {
              complaintId: complaint.id,
              pseudonym: complaint.pseudonym,
              priority: complaint.priority,
              breachType,
              hoursElapsed: Math.round(hoursElapsed),
              message: `SLA target breached for [${complaint.priority}] case "${complaint.title}"`,
            },
          });

          // For CRITICAL priority breaches, send high-priority alert email
          if (complaint.priority === Priority.CRITICAL) {
            await mailer.sendEmail({
              to: admin.collegeEmail,
              subject: `[CRITICAL SLA BREACH] Case ${complaint.pseudonym}: Immediate Action Required`,
              text: `URGENT NOTICE: A CRITICAL severity grievance has exceeded institutional SLA resolution targets.\n\nCase: ${complaint.title} (${complaint.pseudonym})\nElapsed Time: ${Math.round(hoursElapsed)} hours (Target: ${allowedHours} hours)\n\nPlease log in to the CampusVoice Admin Console immediately to address this case.`,
            });
          }
        }
      } catch (err) {
        console.warn(`[SLA Notification Warning]:`, (err as Error).message);
      }
    }
  }

  return {
    timestamp: now.toISOString(),
    evaluatedCasesCount: openComplaints.length,
    breachedCasesCount: breaches.length,
    escalatedCasesCount: escalatedCount,
    breaches,
  };
}

/**
 * Calculates current SLA compliance metrics for the Admin Analytics Dashboard.
 */
export async function getSlaComplianceStats() {
  const policies = await getSlaPolicies();
  const allComplaints = await prisma.complaint.findMany({
    select: {
      id: true,
      priority: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      pseudonym: true,
      title: true,
    },
  });

  const now = new Date();
  let totalResolved = 0;
  let resolvedWithinSla = 0;
  const priorityStats: Record<string, { total: number; breached: number; complianceRate: number }> = {
    CRITICAL: { total: 0, breached: 0, complianceRate: 100 },
    HIGH: { total: 0, breached: 0, complianceRate: 100 },
    MEDIUM: { total: 0, breached: 0, complianceRate: 100 },
    LOW: { total: 0, breached: 0, complianceRate: 100 },
  };

  const currentlyBreached: Array<{
    id: string;
    pseudonym: string;
    title: string;
    priority: Priority;
    hoursOpen: number;
    targetHours: number;
  }> = [];

  for (const c of allComplaints) {
    const policy = policies[c.priority] || DEFAULT_SLA_POLICIES[Priority.MEDIUM];
    const isResolved = [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(c.status as any);
    const endTime = isResolved && c.resolvedAt ? new Date(c.resolvedAt).getTime() : now.getTime();
    const durationHours = (endTime - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);

    const stats = priorityStats[c.priority];
    if (stats) {
      stats.total++;
      if (durationHours > policy.resolutionHours) {
        stats.breached++;
        if (!isResolved) {
          currentlyBreached.push({
            id: c.id,
            pseudonym: c.pseudonym,
            title: c.title,
            priority: c.priority,
            hoursOpen: Math.round(durationHours),
            targetHours: policy.resolutionHours,
          });
        }
      }
    }

    if (isResolved) {
      totalResolved++;
      if (durationHours <= policy.resolutionHours) {
        resolvedWithinSla++;
      }
    }
  }

  // Calculate percentages
  for (const key of Object.keys(priorityStats)) {
    const s = priorityStats[key];
    s.complianceRate = s.total > 0 ? Math.round(((s.total - s.breached) / s.total) * 100) : 100;
  }

  const overallComplianceRate = totalResolved > 0
    ? Math.round((resolvedWithinSla / totalResolved) * 100)
    : 100;

  return {
    overallComplianceRate,
    totalResolved,
    resolvedWithinSla,
    priorityStats,
    currentlyBreached,
  };
}
