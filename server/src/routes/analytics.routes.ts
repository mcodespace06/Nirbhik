import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { analyticsService } from '../services/analytics/analytics.service';
import { checkAndEscalateSLAs, getSlaComplianceStats } from '../services/sla/escalation';

const router = Router();

// Protect all analytics endpoints with ADMIN or SUPER_ADMIN role
router.use(requireAuth);
router.use(requireRole([Role.ADMIN, Role.SUPER_ADMIN]));

/**
 * GET /api/admin/analytics/overview
 * Returns executive KPI summaries, resolution metrics, satisfaction scores, and alert statuses.
 */
router.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const overview = await analyticsService.getOverviewMetrics();
    res.json(overview);
  } catch (err) {
    res.status(500).json({
      error: { code: 'ANALYTICS_OVERVIEW_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * GET /api/admin/analytics/categories
 * Returns complaint counts, resolution speed, and severity metrics per category.
 */
router.get('/categories', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await analyticsService.getCategoryMetrics();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: { code: 'ANALYTICS_CATEGORIES_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * GET /api/admin/analytics/hotspots
 * Returns location coordinates, incident intensity scores, and category breakdowns for Campus Heatmap.
 */
router.get('/hotspots', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const hotspots = await analyticsService.getHotspotMetrics();
    res.json(hotspots);
  } catch (err) {
    res.status(500).json({
      error: { code: 'ANALYTICS_HOTSPOTS_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * GET /api/admin/analytics/trends
 * Returns daily time-series filings and resolutions over specified range (default: 30 days).
 */
router.get('/trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const trends = await analyticsService.getTrendMetrics(days);
    res.json(trends);
  } catch (err) {
    res.status(500).json({
      error: { code: 'ANALYTICS_TRENDS_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * GET /api/admin/analytics/entities
 * Returns target entity patterns, repeat departments/places, and cluster recurrences.
 */
router.get('/entities', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const entities = await analyticsService.getEntityMetrics();
    res.json(entities);
  } catch (err) {
    res.status(500).json({
      error: { code: 'ANALYTICS_ENTITIES_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * GET /api/admin/analytics/sla/status
 * Returns SLA compliance stats, resolution percentages, and currently breached cases.
 */
router.get('/sla/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getSlaComplianceStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({
      error: { code: 'SLA_STATUS_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * POST /api/admin/analytics/sla/check
 * Manually executes SLA compliance scan and auto-escalation across all open complaints.
 */
router.post('/sla/check', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await checkAndEscalateSLAs();
    res.json({
      message: 'SLA check completed.',
      report,
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SLA_CHECK_ERROR', message: (err as Error).message },
    });
  }
});

export default router;
