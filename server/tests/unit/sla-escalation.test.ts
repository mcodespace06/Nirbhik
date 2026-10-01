import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { 
  checkAndEscalateSLAs, 
  getSlaComplianceStats, 
  DEFAULT_SLA_POLICIES 
} from '../../src/services/sla/escalation';
import { Priority, ComplaintStatus, Role, AlertType } from '@prisma/client';
import { mailer } from '../../src/services/notifications/mailer';
import { notificationService } from '../../src/services/notifications/notifications.service';

describe('SLA Escalation Engine & Monitoring (Phase 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('SLA Policies & Thresholds (WORKFLOW.md §7)', () => {
    it('provides standard institutional default policies per priority tier', () => {
      expect(DEFAULT_SLA_POLICIES[Priority.CRITICAL].firstResponseHours).toBe(2);
      expect(DEFAULT_SLA_POLICIES[Priority.CRITICAL].resolutionHours).toBe(24);

      expect(DEFAULT_SLA_POLICIES[Priority.HIGH].firstResponseHours).toBe(24);
      expect(DEFAULT_SLA_POLICIES[Priority.HIGH].resolutionHours).toBe(72);

      expect(DEFAULT_SLA_POLICIES[Priority.MEDIUM].firstResponseHours).toBe(72);
      expect(DEFAULT_SLA_POLICIES[Priority.MEDIUM].resolutionHours).toBe(240);

      expect(DEFAULT_SLA_POLICIES[Priority.LOW].firstResponseHours).toBe(168);
      expect(DEFAULT_SLA_POLICIES[Priority.LOW].resolutionHours).toBe(720);
    });
  });

  describe('checkAndEscalateSLAs()', () => {
    it('detects and auto-escalates an overdue case exceeding resolution SLA', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000); // 120 hours ago

      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'case-overdue-1',
          pseudonym: 'Complainant #A1B2',
          title: 'High priority laboratory heating issue',
          priority: Priority.HIGH, // allowed: 72 hours
          status: ComplaintStatus.TRIAGED,
          createdAt: fiveDaysAgo,
          assignedTo: 'admin-1',
          events: [],
          messages: [{ sender: 'ADMIN', createdAt: fiveDaysAgo } as any],
          riskAlerts: [],
        } as any,
      ]);

      const updateSpy = vi.spyOn(prisma.complaint, 'update').mockResolvedValue({} as any);
      const eventSpy = vi.spyOn(prisma.complaintEvent, 'create').mockResolvedValue({} as any);
      const alertSpy = vi.spyOn(prisma.riskAlert, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { id: 'admin-1', collegeEmail: 'admin@college.edu', role: Role.ADMIN } as any,
      ]);
      vi.spyOn(notificationService, 'createNotification').mockResolvedValue({} as any);

      const report = await checkAndEscalateSLAs();

      expect(report.breachedCasesCount).toBe(1);
      expect(report.escalatedCasesCount).toBe(1);
      expect(report.breaches[0].breachType).toBe('RESOLUTION');
      expect(report.breaches[0].complaintId).toBe('case-overdue-1');

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'case-overdue-1' },
        data: { status: ComplaintStatus.ESCALATED },
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complaintId: 'case-overdue-1',
            type: 'ESCALATED',
          }),
        })
      );

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: AlertType.SLA_BREACH,
            complaintId: 'case-overdue-1',
          }),
        })
      );
    });

    it('detects a first-response breach when no admin has messaged or changed status within threshold', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000); // 3 hours ago for CRITICAL (allowed: 2h)

      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'case-critical-unanswered',
          pseudonym: 'Complainant #CRIT',
          title: 'Physical altercation reported',
          priority: Priority.CRITICAL, // allowed: 2h first response
          status: ComplaintStatus.SUBMITTED, // still untouched!
          createdAt: threeHoursAgo,
          assignedTo: null,
          events: [],
          messages: [], // no admin message!
          riskAlerts: [],
        } as any,
      ]);

      vi.spyOn(prisma.complaint, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma.complaintEvent, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.riskAlert, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { id: 'admin-1', collegeEmail: 'admin@college.edu', role: Role.ADMIN } as any,
      ]);
      const emailSpy = vi.spyOn(mailer, 'sendEmail').mockResolvedValue(true);
      vi.spyOn(notificationService, 'createNotification').mockResolvedValue({} as any);

      const report = await checkAndEscalateSLAs();

      expect(report.breachedCasesCount).toBe(1);
      expect(report.breaches[0].breachType).toBe('FIRST_RESPONSE');
      expect(emailSpy).toHaveBeenCalled(); // High priority CRITICAL breach triggers email
    });

    it('identifies compliant open cases without escalating them', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 3600 * 1000); // 1 hour ago for MEDIUM (allowed: 72h / 240h)

      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'case-fresh',
          pseudonym: 'Complainant #NEW',
          title: 'Classroom projector broken',
          priority: Priority.MEDIUM,
          status: ComplaintStatus.SUBMITTED,
          createdAt: oneHourAgo,
          assignedTo: null,
          events: [],
          messages: [],
          riskAlerts: [],
        } as any,
      ]);

      const updateSpy = vi.spyOn(prisma.complaint, 'update');
      const report = await checkAndEscalateSLAs();

      expect(report.breachedCasesCount).toBe(0);
      expect(report.escalatedCasesCount).toBe(0);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('getSlaComplianceStats()', () => {
    it('calculates resolution compliance rate correctly', async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        // Resolved within SLA: HIGH (72h limit, resolved in 24h)
        {
          id: 'c1',
          priority: Priority.HIGH,
          status: ComplaintStatus.RESOLVED,
          createdAt: twoDaysAgo,
          resolvedAt: oneDayAgo,
          pseudonym: '#C1',
          title: 'Case 1',
        } as any,
        // Resolved past SLA: CRITICAL (24h limit, resolved in 48h)
        {
          id: 'c2',
          priority: Priority.CRITICAL,
          status: ComplaintStatus.RESOLVED,
          createdAt: new Date(Date.now() - 72 * 3600 * 1000),
          resolvedAt: oneDayAgo, // took 48h
          pseudonym: '#C2',
          title: 'Case 2',
        } as any,
      ]);

      const stats = await getSlaComplianceStats();

      expect(stats.totalResolved).toBe(2);
      expect(stats.resolvedWithinSla).toBe(1);
      expect(stats.overallComplianceRate).toBe(50); // 1 out of 2 resolved within SLA
    });
  });
});
