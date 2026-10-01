import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { getAuditLogs, getAuditSummary } from '../services/audit/audit.service';

const router = Router();

// Only Super Admins have access to the immutable security audit trail
router.use(requireAuth, requireRole([Role.SUPER_ADMIN]));

/**
 * GET /api/admin/audit-logs
 * Retrieves paginated audit trail logs with filtering
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actorId, action, entity, startDate, endDate, limit, offset } = req.query;

    const result = await getAuditLogs({
      actorId: actorId ? String(actorId) : undefined,
      action: action ? String(action) : undefined,
      entity: entity ? String(entity) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });

    res.json({
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'AUDIT_QUERY_FAILED',
        message: err.message || 'Failed to retrieve audit log entries.',
      },
    });
  }
});

/**
 * GET /api/admin/audit-logs/summary
 * Returns high-level overview metrics of system audit actions
 */
router.get('/summary', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await getAuditSummary();
    res.json({ data: summary });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'AUDIT_SUMMARY_FAILED',
        message: err.message || 'Failed to generate audit summary.',
      },
    });
  }
});

export default router;
