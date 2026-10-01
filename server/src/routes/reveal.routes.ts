import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { Role, ComplaintMode } from '@prisma/client';
import { vaultService } from '../services/vault';
import { recordAuditLog } from '../services/audit/audit.service';

const router = Router();

// Only Super Admins can access break-glass reveal endpoints (WORKFLOW.md §11)
router.use(requireAuth, requireRole([Role.SUPER_ADMIN]));

const RevealRequestSchema = z.object({
  complaintId: z.string().uuid(),
  reason: z.string().min(10, 'A formal legal or safety justification of at least 10 characters is required'),
});

const RevealDecideSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  decisionReason: z.string().optional(),
});

/**
 * GET /api/admin/reveal
 * List all break-glass requests
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await prisma.breakGlassRequest.findMany({
      include: {
        complaint: {
          select: {
            id: true,
            title: true,
            mode: true,
            pseudonym: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: requests });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to list break-glass requests.' },
    });
  }
});

/**
 * POST /api/admin/reveal/request
 * Super Admin A submits a formal identity reveal request with written legal justification
 */
router.post('/request', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = RevealRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid reveal request format.', details: parsed.error.format() },
      });
    }

    const { complaintId, reason } = parsed.data;

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // STRICT: Ultra-Anonymous complaints have NO vault records and cannot be broken (ARCHITECTURE.md §5 / WORKFLOW §11)
    if (complaint.mode === ComplaintMode.ULTRA_ANON) {
      return res.status(400).json({
        error: {
          code: 'ULTRA_ANON_IRREVERSIBLE',
          message: 'This complaint was submitted in Ultra-Anonymous mode. No cryptographic link exists in the Vault.',
        },
      });
    }

    const request = await prisma.breakGlassRequest.create({
      data: {
        complaintId,
        requestedBy: req.user!.id,
        reason,
        status: 'PENDING',
      },
    });

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'IDENTITY_REVEAL_REQUESTED',
      entity: 'break_glass_requests',
      entityId: request.id,
      meta: { complaintId, reason },
    });

    res.status(201).json({
      message: 'Break-glass reveal request initiated. Awaiting review by a second Super Administrator.',
      data: request,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to initiate break-glass request.' },
    });
  }
});

/**
 * POST /api/admin/reveal/:id/decide
 * Super Admin B (different person) approves or rejects the reveal (Dual Authorization)
 */
router.post('/:id/decide', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = RevealDecideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid decision payload.', details: parsed.error.format() },
      });
    }

    const { action, decisionReason } = parsed.data;

    const request = await prisma.breakGlassRequest.findUnique({
      where: { id },
      include: { complaint: true },
    });

    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Break-glass request not found.' },
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        error: { code: 'ALREADY_DECIDED', message: `Request is already ${request.status}.` },
      });
    }

    // DUAL AUTHORIZATION ENFORCEMENT: Approver must NOT be the requester
    if (request.requestedBy === req.user!.id) {
      return res.status(403).json({
        error: {
          code: 'DUAL_AUTH_VIOLATION',
          message: 'Dual authorization required. A different Super Administrator must review and approve this request.',
        },
      });
    }

    if (action === 'REJECT') {
      const updated = await prisma.breakGlassRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approverId: req.user!.id,
          decidedAt: new Date(),
        },
      });

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'IDENTITY_REVEAL_REJECTED',
        entity: 'break_glass_requests',
        entityId: id,
        meta: { decisionReason },
      });

      return res.json({
        message: 'Break-glass request rejected.',
        data: updated,
      });
    }

    // APPROVAL: Resolve reporter userId from Vault
    const reporterUserId = await vaultService.resolveUserForComplaint(request.complaintId);
    if (!reporterUserId) {
      return res.status(404).json({
        error: {
          code: 'VAULT_NOT_FOUND',
          message: 'No cryptographic vault link was found for this case.',
        },
      });
    }

    const reporter = await prisma.user.findUnique({
      where: { id: reporterUserId },
      include: { rosterEntry: true },
    });

    await prisma.breakGlassRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: req.user!.id,
        decidedAt: new Date(),
      },
    });

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'IDENTITY_REVEAL_APPROVED',
      entity: 'break_glass_requests',
      entityId: id,
      meta: {
        complaintId: request.complaintId,
        requestedBy: request.requestedBy,
        approverId: req.user!.id,
        reason: request.reason,
      },
    });

    return res.json({
      message: 'Identity revealed under dual Super Admin authorization.',
      revealedIdentity: {
        userId: reporter?.id,
        username: reporter?.username,
        fullName: reporter?.rosterEntry?.fullName || 'N/A',
        enrollmentNo: reporter?.rosterEntry?.enrollmentNo || 'N/A',
        collegeEmail: reporter?.collegeEmail,
        department: reporter?.department || reporter?.rosterEntry?.department,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to process break-glass decision.' },
    });
  }
});

export default router;
