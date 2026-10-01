import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { signToken } from '../../src/services/auth/tokens';
import { Role, ComplaintStatus, Priority, RestrictedQueue } from '@prisma/client';

describe('Analytics, Hotspots, SLA & Notifications Integration (Phase 7)', () => {
  const adminToken = signToken({
    id: 'admin-1',
    username: 'admin_case1',
    role: Role.ADMIN,
    status: 'ACTIVE',
    collegeEmail: 'admin1@campus.edu',
  });

  const studentToken = signToken({
    id: 'student-1',
    username: 'student_user',
    role: Role.STUDENT,
    status: 'ACTIVE',
    collegeEmail: 'student@college.edu',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/analytics/overview', () => {
    it('returns executive KPI metrics for admin users', async () => {
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'c1',
          status: ComplaintStatus.RESOLVED,
          priority: Priority.HIGH,
          mode: 'CONFIDENTIAL',
          satisfactionRating: 5,
          createdAt: new Date(Date.now() - 48 * 3600 * 1000),
          resolvedAt: new Date(Date.now() - 24 * 3600 * 1000),
        } as any,
        {
          id: 'c2',
          status: ComplaintStatus.IN_PROGRESS,
          priority: Priority.MEDIUM,
          mode: 'ULTRA_ANON',
          satisfactionRating: null,
          createdAt: new Date(Date.now() - 12 * 3600 * 1000),
          resolvedAt: null,
        } as any,
      ]);
      vi.spyOn(prisma.riskAlert, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.sosEvent, 'count').mockResolvedValue(2);

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalComplaints).toBe(2);
      expect(res.body.resolvedCount).toBe(1);
      expect(res.body.activeCount).toBe(1);
      expect(res.body.resolutionRate).toBe(50);
      expect(res.body.avgResolutionHours).toBe(24);
      expect(res.body.satisfaction.averageRating).toBe(5);
      expect(res.body.modeDistribution.confidential).toBe(1);
      expect(res.body.modeDistribution.ultraAnon).toBe(1);
      expect(res.body.sosEventsTotal).toBe(2);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('rejects student requests with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/categories', () => {
    it('returns category distribution and resolution speeds', async () => {
      vi.spyOn(prisma.category, 'findMany').mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Infrastructure',
          severityWeight: 10,
          isSafety: false,
          routesToQueue: RestrictedQueue.NONE,
          complaints: [
            {
              id: 'c1',
              status: ComplaintStatus.RESOLVED,
              createdAt: new Date(Date.now() - 20 * 3600 * 1000),
              resolvedAt: new Date(Date.now() - 10 * 3600 * 1000),
            },
          ],
        } as any,
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalCategories).toBe(1);
      expect(res.body.breakdown[0].name).toBe('Infrastructure');
      expect(res.body.breakdown[0].totalComplaints).toBe(1);
      expect(res.body.breakdown[0].avgResolutionHours).toBe(10);
    });
  });

  describe('GET /api/admin/analytics/hotspots', () => {
    it('returns location coordinate nodes with intensity scores for Campus Heatmap', async () => {
      vi.spyOn(prisma.location, 'findMany').mockResolvedValue([
        {
          id: 'loc-1',
          name: 'Central University Library',
          lat: 19.0765,
          lng: 72.8782,
          complaints: [
            {
              id: 'c1',
              status: ComplaintStatus.IN_PROGRESS,
              priority: Priority.HIGH,
              category: { name: 'Safety/Security' },
            },
            {
              id: 'c2',
              status: ComplaintStatus.RESOLVED,
              priority: Priority.MEDIUM,
              category: { name: 'Safety/Security' },
            },
          ],
        } as any,
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/hotspots')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.locationsCount).toBe(1);
      expect(res.body.hotspots[0].name).toBe('Central University Library');
      expect(res.body.hotspots[0].lat).toBe(19.0765);
      expect(res.body.hotspots[0].lng).toBe(72.8782);
      expect(res.body.hotspots[0].totalComplaints).toBe(2);
      expect(res.body.hotspots[0].activeComplaints).toBe(1);
      expect(res.body.hotspots[0].topCategory).toBe('Safety/Security');
      expect(res.body.hotspots[0].intensity).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/analytics/sla/status and POST /api/admin/analytics/sla/check', () => {
    it('returns SLA compliance statistics', async () => {
      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'c1',
          priority: Priority.MEDIUM,
          status: ComplaintStatus.RESOLVED,
          createdAt: new Date(Date.now() - 48 * 3600 * 1000),
          resolvedAt: new Date(Date.now() - 24 * 3600 * 1000),
          pseudonym: '#C1',
          title: 'Case 1',
        } as any,
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/sla/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.overallComplianceRate).toBe(100);
      expect(res.body.totalResolved).toBe(1);
    });

    it('triggers on-demand SLA escalation scan', async () => {
      vi.spyOn(prisma.slaPolicy, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/admin/analytics/sla/check')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('SLA check completed.');
      expect(res.body.report.evaluatedCasesCount).toBe(0);
    });
  });

  describe('GET /api/transparency', () => {
    it('is publicly accessible without authentication and contains zero PII', async () => {
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'c1',
          status: ComplaintStatus.RESOLVED,
          satisfactionRating: 5,
          createdAt: new Date(Date.now() - 72 * 3600 * 1000),
          resolvedAt: new Date(Date.now() - 24 * 3600 * 1000),
          category: { name: 'Infrastructure' },
        } as any,
      ]);

      const res = await request(app).get('/api/transparency');

      expect(res.status).toBe(200);
      expect(res.body.reportTitle).toContain('Transparency Report');
      expect(res.body.overallMetrics.totalHandled).toBe(1);
      expect(res.body.overallMetrics.resolutionRatePercent).toBe(100);
      expect(res.body.institutionalIntegrity.vaultIsolatedEncryption).toBe('AES-256-GCM Active');
      expect(res.body.institutionalIntegrity.breakGlassRevealsQuarterly).toBe(0);

      // Verify ZERO PII in output
      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('student@college.edu');
      expect(jsonStr).not.toContain('EN2026');
      expect(jsonStr).not.toContain('password');
    });
  });

  describe('Notifications Endpoints (/api/notifications)', () => {
    it('lists user notifications and unread count', async () => {
      vi.spyOn(prisma.notification, 'findMany').mockResolvedValue([
        {
          id: 'n1',
          userId: 'student-1',
          channel: 'IN_APP',
          type: 'CASE_STATUS_CHANGED',
          payload: { message: 'Your case has been updated to IN_PROGRESS' },
          readAt: null,
          createdAt: new Date(),
        } as any,
      ]);
      vi.spyOn(prisma.notification, 'count').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.notifications[0].type).toBe('CASE_STATUS_CHANGED');
    });

    it('marks a single notification as read', async () => {
      vi.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch('/api/notifications/n1/read')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe('n1');
    });

    it('marks all user notifications as read', async () => {
      vi.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 5 });

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
