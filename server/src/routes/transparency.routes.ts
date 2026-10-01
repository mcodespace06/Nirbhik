import { Router, Request, Response } from 'express';
import { analyticsService } from '../services/analytics/analytics.service';

const router = Router();

/**
 * GET /api/transparency
 * Publicly accessible transparency metrics (PRD §6.10 ADM-9).
 * Completely anonymized, privacy-safe campus reporting and safety performance stats.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const report = await analyticsService.getPublicTransparencyReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'TRANSPARENCY_REPORT_ERROR',
        message: (err as Error).message,
      },
    });
  }
});

export default router;
