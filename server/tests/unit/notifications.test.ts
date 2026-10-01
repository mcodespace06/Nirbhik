import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { notificationService } from '../../src/services/notifications/notifications.service';
import { notificationBus } from '../../src/services/notifications/bus';

describe('Notification Service (Phase 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an in-app notification and emits event through notificationBus', async () => {
    const mockCreated = {
      id: 'notif-1',
      userId: 'user-123',
      channel: 'IN_APP',
      type: 'CASE_STATUS_UPDATED',
      payload: { complaintId: 'case-1', status: 'IN_PROGRESS' },
      readAt: null,
      createdAt: new Date(),
    };

    vi.spyOn(prisma.notification, 'create').mockResolvedValue(mockCreated as any);
    const emitSpy = vi.spyOn(notificationBus, 'emitNotification');

    const result = await notificationService.createNotification({
      userId: 'user-123',
      channel: 'IN_APP',
      type: 'CASE_STATUS_UPDATED',
      payload: { complaintId: 'case-1', status: 'IN_PROGRESS' },
    });

    expect(result.id).toBe('notif-1');
    expect(emitSpy).toHaveBeenCalledWith('user-123', mockCreated);
  });

  it('lists user notifications and returns accurate unread count', async () => {
    const mockList = [
      { id: 'notif-1', userId: 'user-123', readAt: null, type: 'ALERT' },
      { id: 'notif-2', userId: 'user-123', readAt: new Date(), type: 'INFO' },
    ];

    vi.spyOn(prisma.notification, 'findMany').mockResolvedValue(mockList as any);
    vi.spyOn(prisma.notification, 'count').mockResolvedValue(1);

    const data = await notificationService.getUserNotifications('user-123');

    expect(data.notifications.length).toBe(2);
    expect(data.unreadCount).toBe(1);
  });

  it('marks a single notification as read', async () => {
    const updateSpy = vi.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 1 });

    await notificationService.markAsRead('notif-1', 'user-123');

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1', userId: 'user-123' },
        data: { readAt: expect.any(Date) },
      })
    );
  });

  it('marks all notifications for user as read', async () => {
    const updateSpy = vi.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 3 });

    await notificationService.markAllAsRead('user-123');

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', readAt: null },
        data: { readAt: expect.any(Date) },
      })
    );
  });
});
