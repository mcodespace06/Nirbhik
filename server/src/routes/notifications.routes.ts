import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { notificationService } from '../services/notifications/notifications.service';
import { notificationBus } from '../services/notifications/bus';

const router = Router();

/**
 * GET /api/notifications
 * Lists notifications for the authenticated user with unread count.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const unreadOnly = req.query.unread === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const data = await notificationService.getUserNotifications(userId, { unreadOnly, limit });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { code: 'NOTIFICATIONS_FETCH_FAILED', message: (err as Error).message } });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await notificationService.markAsRead(id, userId);
    res.json({ success: true, id, readAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: { code: 'MARK_READ_FAILED', message: (err as Error).message } });
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all notifications for the current user as read.
 */
router.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: { code: 'MARK_ALL_READ_FAILED', message: (err as Error).message } });
  }
});

/**
 * GET /api/stream/notifications
 * Real-time Server-Sent Events (SSE) notification stream for active web client.
 */
router.get('/stream', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial ping to establish connection
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);

  const onNotification = (notif: any) => {
    res.write(`event: notification\ndata: ${JSON.stringify(notif)}\n\n`);
  };

  notificationBus.on(`notification:${userId}`, onNotification);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationBus.off(`notification:${userId}`, onNotification);
    res.end();
  });
});

export default router;
