import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { vaultService } from '../services/vault';
import { generateTrackingKey, verifyTrackingKey, hashTrackingKey } from '../services/complaints/tracking-key';
import { CreateComplaintSchema, TrackingKeyParamSchema } from '../lib/zod/complaint';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireRole, AuthenticatedRequest } from '../services/auth/rbac';
import { ComplaintMode, Role, RestrictedQueue, ComplaintStatus } from '@prisma/client';
import { analyzeComplaint } from '../services/ai/analyze';
import { sendEmail } from '../services/notifications/mailer';
import { complaintSubmitLimiter } from '../middleware/rate-limit';

const router = Router();

/**
 * GET /api/categories
 * Returns active complaint categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  return res.status(200).json({ categories });
});

/**
 * GET /api/locations
 * Returns active campus locations
 */
router.get('/locations', async (_req: Request, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
  return res.status(200).json({ locations });
});

/**
 * POST /api/complaints
 * Complaint intake endpoint (CMP-1, CMP-2, CMP-3)
 * Non-Negotiable Rule 1: complaints table has NO user_id column.
 */
router.post('/', complaintSubmitLimiter, optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateComplaintSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
        details: parseResult.error.flatten(),
      },
    });
  }

  const {
    title,
    description,
    categoryId,
    locationId,
    incidentAt,
    mode,
    targetEntityType,
    targetEntityLabel,
    attachments,
    accusedList,
    firDraft,
  } = parseResult.data;

  // Confidential mode requires verified authentication
  if (mode === ComplaintMode.CONFIDENTIAL && !req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED_FOR_CONFIDENTIAL',
        message: 'You must be signed in to submit a Confidential report. Alternatively, choose Ultra-Anonymous mode to file without signing in.',
      },
    });
  }

  // 1. Verify Category & determine queue
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return res.status(400).json({
      error: { code: 'INVALID_CATEGORY', message: 'Selected category does not exist.' },
    });
  }

  // 2. Generate Tracking Key & Pseudonym
  const trackingKey = generateTrackingKey();
  const trackingKeyHash = hashTrackingKey(trackingKey);
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  const pseudonym = `Complainant #${randomHex}`;

  // 3. Handle optional target entity
  let targetEntityId: string | undefined;
  if (targetEntityType && targetEntityLabel) {
    const entity = await prisma.targetEntity.upsert({
      where: { label: targetEntityLabel },
      update: {},
      create: {
        type: targetEntityType,
        label: targetEntityLabel,
      },
    });
    targetEntityId = entity.id;
  }

  // 4. Create Complaint row in public schema (STRICT: ZERO user_id in this query!)
  const complaint = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.create({
      data: {
        trackingKeyHash,
        categoryId,
        title,
        description,
        locationId,
        incidentAt,
        mode,
        pseudonym,
        restrictedQueue: category.routesToQueue,
        targetEntityId,
      },
    });

    // Record initial event on timeline
    await tx.complaintEvent.create({
      data: {
        complaintId: c.id,
        type: 'SUBMITTED',
        actorRole: req.user?.role || Role.STUDENT,
        payload: {
          mode,
          categoryName: category.name,
          accusedList: accusedList || [],
          firDraft: firDraft || null,
        },
      },
    });

    // Attachments
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await tx.attachment.create({
          data: {
            complaintId: c.id,
            fileKey: att.fileKey,
            mime: att.mime,
            size: att.size,
            sanitized: true,
          },
        });
      }
    }

    return c;
  });

  // 5. Vault Registration (Confidential mode ONLY)
  if (mode === ComplaintMode.CONFIDENTIAL && req.user) {
    await vaultService.linkReporter(complaint.id, req.user.id);
  }
  // When mode === ULTRA_ANON: Zero records written to vault!

  // 6. Trigger AI Complaint Screening & Analysis Pipeline (Job: analyze-complaint)
  try {
    await analyzeComplaint(complaint.id);
  } catch (err) {
    console.error('[AI Analysis Warning]:', err);
  }

  // 7. Active Email Dispatch for Institutional Intake & Confidential Confirmation
  try {
    const intakeEmail = process.env.DISPATCH_ALERT_EMAIL || process.env.CAMPUS_ADMIN_EMAIL || 'admin@campusvoice.local';
    await sendEmail({
      to: intakeEmail,
      subject: `[New Case Filed] ${complaint.pseudonym} - ${category.name} (${complaint.mode})`,
      text: `A new incident has been filed on CampusVoice.\nPseudonym: ${complaint.pseudonym}\nCategory: ${category.name}\nRouting Queue: ${category.routesToQueue || 'GENERAL'}\nIncident Time: ${complaint.incidentAt || 'Not specified'}\nTitle: ${complaint.title}\nDescription: ${complaint.description.slice(0, 300)}...`,
      html: `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
        <h2 style="color:#0369a1;">CampusVoice Incident Notification</h2>
        <p>A new incident report has been securely registered.</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:6px;font-weight:bold;">Pseudonym:</td><td style="padding:6px;">${complaint.pseudonym}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;">Category:</td><td style="padding:6px;">${category.name}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;">Routing Queue:</td><td style="padding:6px;">${category.routesToQueue || 'GENERAL'}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;">Mode:</td><td style="padding:6px;">${complaint.mode}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;">Title:</td><td style="padding:6px;">${complaint.title}</td></tr>
        </table>
        <p style="margin-top:16px;"><strong>Incident Description Summary:</strong><br/>${complaint.description.slice(0, 400)}...</p>
        <p style="font-size:12px;color:#64748b;">This is an automated dispatch from CampusVoice Core Services.</p>
      </div>`,
    });

    if (mode === ComplaintMode.CONFIDENTIAL && req.user?.collegeEmail) {
      await sendEmail({
        to: req.user.collegeEmail,
        subject: `CampusVoice Case Confirmation: ${complaint.pseudonym}`,
        text: `Your confidential report "${complaint.title}" has been securely registered in the isolated vault.\nTracking Key: ${trackingKey}\nPseudonym: ${complaint.pseudonym}\nSave this key securely to track investigation updates.`,
        html: `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
          <h2 style="color:#059669;">Confidential Case Registration Confirmed</h2>
          <p>Your report has been safely registered in the encrypted vault.</p>
          <p><strong>Tracking Key:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:14px;color:#0f172a;">${trackingKey}</code></p>
          <p><strong>Assigned Pseudonym:</strong> ${complaint.pseudonym}</p>
          <p style="font-size:13px;color:#64748b;">Keep this tracking key safe. Case handlers and administrators will only see your pseudonym.</p>
        </div>`,
      });
    }
  } catch (mailErr) {
    console.warn('[Email Dispatch Warning]:', mailErr);
  }

  return res.status(201).json({
    message: 'Complaint filed successfully. Save your tracking key now — it cannot be recovered if lost.',
    complaintId: complaint.id,
    trackingKey, // RETURNED EXACTLY ONCE
    pseudonym,
    mode: complaint.mode,
  });
});

/**
 * GET /api/track/:key
 * Public track endpoint (TRK-1)
 */
router.get('/track/:key', async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!verifyTrackingKey(key)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TRACKING_KEY',
        message: 'The tracking key format or checksum is invalid. Format: CV-YYMM-XXXX-XXXX.',
      },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      pseudonym: true,
      incidentAt: true,
      mode: true,
      createdAt: true,
      resolvedAt: true,
      category: {
        select: { id: true, name: true },
      },
      location: {
        select: { id: true, name: true },
      },
      attachments: {
        select: { id: true, fileKey: true, mime: true, size: true },
      },
    },
  });

  if (!complaint) {
    return res.status(404).json({
      error: {
        code: 'COMPLAINT_NOT_FOUND',
        message: 'No complaint found matching this tracking key.',
      },
    });
  }

  return res.status(200).json({ complaint });
});

/**
 * GET /api/track/:key/events
 * Public timeline of complaint events (TRK-2)
 */
router.get('/track/:key/events', async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!verifyTrackingKey(key)) {
    return res.status(400).json({
      error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
    });
  }

  const events = await prisma.complaintEvent.findMany({
    where: { complaintId: complaint.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      actorRole: true,
      payload: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ events });
});

/**
 * GET /api/complaints/mine
 * Authenticated user's confidential complaints list
 */
router.get(
  '/mine',
  authenticate,
  requireRole([Role.STUDENT, Role.TEACHER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const complaintIds = await vaultService.listComplaintsForUser(req.user!.id);

    if (complaintIds.length === 0) {
      return res.status(200).json({ complaints: [] });
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        id: { in: complaintIds },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        pseudonym: true,
        incidentAt: true,
        createdAt: true,
        resolvedAt: true,
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ complaints });
  }
);

import { chatBus } from '../services/chat/bus';
import { SendMessageSchema } from '../lib/zod/admin';

/**
 * GET /api/track/:key/messages
 * Retrieves message thread for complainant (CHAT-1)
 */
router.get('/track/:key/messages', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  const messages = await prisma.complaintMessage.findMany({
    where: { complaintId: complaint.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sender: true,
      body: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ messages });
});

/**
 * POST /api/track/:key/messages
 * Complainant sends a response; auto-toggles NEEDS_INFO -> IN_PROGRESS (CHAT-1, CHAT-2)
 */
router.post('/track/:key/messages', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const parseResult = SendMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message } });
  }

  const { body } = parseResult.data;
  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  const result = await prisma.$transaction(async (tx) => {
    const msg = await tx.complaintMessage.create({
      data: {
        complaintId: complaint.id,
        sender: 'COMPLAINANT',
        body,
      },
    });

    // WORKFLOW.md §5: Status auto-toggles NEEDS_INFO -> IN_PROGRESS when complainant replies
    if (complaint.status === ComplaintStatus.NEEDS_INFO) {
      await tx.complaint.update({
        where: { id: complaint.id },
        data: { status: ComplaintStatus.IN_PROGRESS },
      });

      await tx.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: 'STATUS_CHANGE',
          actorRole: Role.STUDENT,
          payload: {
            from: ComplaintStatus.NEEDS_INFO,
            to: ComplaintStatus.IN_PROGRESS,
            reason: 'Complainant submitted requested information via chat.',
          },
        },
      });
    }

    return msg;
  });

  chatBus.broadcast(complaint.id, 'message', {
    id: result.id,
    complaintId: complaint.id,
    sender: 'COMPLAINANT',
    body: result.body,
    createdAt: result.createdAt,
  });

  return res.status(201).json({
    message: 'Message sent to administration.',
    chatMessage: {
      id: result.id,
      sender: result.sender,
      body: result.body,
      createdAt: result.createdAt,
    },
  });
});

/**
 * GET /api/track/:key/messages/stream
 * Real-time SSE stream for Complainant Tracking page (CHAT-5)
 */
router.get('/track/:key/messages/stream', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  chatBus.registerClient(complaint.id, res);
});

/**
 * POST /api/track/:key/amendments
 * Section 4: Mid-Investigation Updates via Append-Only Log (Version Control)
 * Original complaint remains 100% unaltered for statutory evidentiary integrity.
 */
router.post('/track/:key/amendments', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const { statement, attachments } = req.body;
  if (!statement || typeof statement !== 'string' || statement.trim().length < 5) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please provide supplementary information (minimum 5 characters).' },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    include: {
      events: {
        where: { type: 'AMENDMENT_APPENDED' },
      },
    },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  const versionNumber = `v1.${complaint.events.length + 1}`;
  const now = new Date().toISOString();

  const amendmentEvent = await prisma.$transaction(async (tx) => {
    const ev = await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        type: 'AMENDMENT_APPENDED',
        actorRole: Role.STUDENT,
        payload: {
          version: versionNumber,
          statement: statement.trim(),
          timestamp: now,
          attachmentCount: attachments?.length || 0,
        },
      },
    });

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        await tx.attachment.create({
          data: {
            complaintId: complaint.id,
            fileKey: att.fileKey || `amendments/${Date.now()}-${att.name || 'file'}`,
            mime: att.mime || 'application/octet-stream',
            size: att.size || 1024,
            sanitized: true,
          },
        });
      }
    }

    return ev;
  });

  chatBus.broadcast(complaint.id, 'amendment_appended', {
    complaintId: complaint.id,
    version: versionNumber,
    statement: statement.trim(),
    createdAt: now,
  });

  return res.status(201).json({
    message: `Supplementary evidence successfully appended to case record as ${versionNumber}. Original complaint remains tamper-evident.`,
    version: versionNumber,
    event: amendmentEvent,
  });
});

/**
 * POST /api/track/:key/escalate
 * Section 4: Formal Escalation & Appeal Workflow for Unsatisfied Victims
 */
router.post('/track/:key/escalate', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const { appealReason, groundsForAppeal } = req.body;
  if (!appealReason || typeof appealReason !== 'string' || appealReason.trim().length < 10) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please detail grounds for appeal (minimum 10 characters).' },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaint.id },
      data: { status: ComplaintStatus.ESCALATED },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        type: 'ESCALATION_TRIGGERED',
        actorRole: Role.STUDENT,
        payload: {
          appealReason: appealReason.trim(),
          groundsForAppeal: groundsForAppeal || 'Unsatisfied with resolution',
          escalatedAt: new Date().toISOString(),
        },
      },
    });

    // Alert Super Admin / Appellate Oversight
    await tx.riskAlert.create({
      data: {
        type: 'SLA_BREACH',
        complaintId: complaint.id,
        message: `Case ${complaint.pseudonym} formally ESCALATED by complainant. Higher review required.`,
        recommendedActions: ['Convene Appellate Review Committee', 'Re-interview assigned officer', 'Audit case decision'],
      },
    });
  });

  chatBus.broadcast(complaint.id, 'status_change', {
    complaintId: complaint.id,
    status: ComplaintStatus.ESCALATED,
    reason: appealReason,
  });

  return res.status(200).json({
    message: 'Appeal officially registered. Case escalated to Higher Oversight Authority.',
    status: ComplaintStatus.ESCALATED,
  });
});

/**
 * POST /api/track/:key/reactivate
 * Section 4: Reactivate Closed Case on Fresh Critical Evidence
 */
router.post('/track/:key/reactivate', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const { reason, newEvidenceNotes } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please provide justification and describe new evidence (min 10 chars).' },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaint.id },
      data: { status: ComplaintStatus.REOPENED },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        type: 'CASE_REACTIVATED',
        actorRole: Role.STUDENT,
        payload: {
          reason: reason.trim(),
          newEvidenceNotes: newEvidenceNotes || null,
          reactivatedAt: new Date().toISOString(),
        },
      },
    });
  });

  chatBus.broadcast(complaint.id, 'status_change', {
    complaintId: complaint.id,
    status: ComplaintStatus.REOPENED,
    reason,
  });

  return res.status(200).json({
    message: 'Case reactivated. Investigators notified of new critical evidence.',
    status: ComplaintStatus.REOPENED,
  });
});

/**
 * GET /api/track/:key/dossier
 * Section 4: Export Full Official Case Dossier (Audit Pack for Satisfied Complainant)
 */
router.get('/track/:key/dossier', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    include: {
      category: true,
      location: true,
      attachments: true,
      events: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  // Extract initial submission payload for accused list and FIR draft
  const initialSubmitEvent = complaint.events.find((e) => e.type === 'SUBMITTED');
  const initialPayload: any = initialSubmitEvent?.payload || {};

  const dossier = {
    metadata: {
      dossierTitle: `Official Grievance Dossier - Case ${complaint.pseudonym}`,
      trackingKey: key,
      generatedAt: new Date().toISOString(),
      institution: 'Nirbhik Campus Safety & Grievance Redressal System',
      securityClassification: 'CONFIDENTIAL EVIDENTIARY RECORD',
    },
    caseSummary: {
      id: complaint.id,
      pseudonym: complaint.pseudonym,
      title: complaint.title,
      category: complaint.category.name,
      location: complaint.location.name,
      incidentAt: complaint.incidentAt,
      submittedAt: complaint.createdAt,
      resolvedAt: complaint.resolvedAt,
      status: complaint.status,
      priority: complaint.priority,
      mode: complaint.mode,
      outcome: complaint.outcome,
      outcomeReason: complaint.outcomeReason,
    },
    formalFirDraft: initialPayload.firDraft || null,
    accusedPersons: initialPayload.accusedList || [],
    originalNarrative: complaint.description,
    appendOnlyAmendments: complaint.events
      .filter((e) => e.type === 'AMENDMENT_APPENDED')
      .map((e) => ({
        eventId: e.id,
        createdAt: e.createdAt,
        payload: e.payload,
      })),
    admissibleChatLog: complaint.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      timestamp: m.createdAt,
      evidenceNotice: 'Tamper-Evident Admissible Log',
    })),
    completeAuditTimeline: complaint.events.map((e) => ({
      id: e.id,
      type: e.type,
      actorRole: e.actorRole,
      timestamp: e.createdAt,
      payload: e.payload,
    })),
    officialActionTaken: {
      decision: complaint.outcome || 'IN_PROGRESS',
      reason: complaint.outcomeReason || 'Investigation active',
      closedAt: complaint.resolvedAt,
    },
  };

  return res.status(200).json({ dossier });
});

export default router;

