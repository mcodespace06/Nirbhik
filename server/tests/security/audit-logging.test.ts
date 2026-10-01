import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAuditLog, getAuditLogs } from '../../src/services/audit/audit.service';
import { prisma } from '../../src/lib/prisma';
import request from 'supertest';
import app from '../../src/index';
import { signToken } from '../../src/services/auth/tokens';
import { Role, UserStatus } from '@prisma/client';

describe('Audit Logging & Ledger Verification (Phase 8, ARCHITECTURE §11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records an audit log entry with actor, action, and meta', async () => {
    const mockCreate = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({
      id: 'audit-1',
      actorId: 'admin-1',
      action: 'ADMIN_LOGIN',
      entity: 'users',
      entityId: 'admin-1',
      meta: { ip: '127.0.0.1' },
      createdAt: new Date(),
    } as any);

    const result = await recordAuditLog({
      actorId: 'admin-1',
      action: 'ADMIN_LOGIN',
      entity: 'users',
      entityId: 'admin-1',
      meta: { ip: '127.0.0.1' },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
    expect(result?.action).toBe('ADMIN_LOGIN');
  });

  it('retrieves paginated audit logs filtered by action', async () => {
    vi.spyOn(prisma.auditLog, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([
      {
        id: 'audit-1',
        actorId: 'admin-1',
        action: 'ROSTER_IMPORT',
        entity: 'college_roster',
        entityId: 'bulk',
        meta: { count: 25 },
        createdAt: new Date(),
        actor: {
          id: 'admin-1',
          username: 'superadmin',
          role: 'SUPER_ADMIN',
          collegeEmail: 'admin@college.edu',
        },
      },
    ] as any);

    const res = await getAuditLogs({ action: 'ROSTER_IMPORT' });
    expect(res.total).toBe(1);
    expect(res.logs[0].action).toBe('ROSTER_IMPORT');
  });

  it('allows Super Admin to query audit logs via GET /api/admin/audit-logs', async () => {
    const superAdminToken = signToken({
      id: 'super-admin-uuid',
      username: 'chief_admin',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      collegeEmail: 'chief@college.edu',
    });

    vi.spyOn(prisma.auditLog, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([
      {
        id: 'log-1',
        actorId: 'super-admin-uuid',
        action: 'CASE_UPDATED',
        entity: 'complaints',
        entityId: 'case-123',
        meta: { targetStatus: 'RESOLVED' },
        createdAt: new Date(),
        actor: {
          id: 'super-admin-uuid',
          username: 'chief_admin',
          role: 'SUPER_ADMIN',
          collegeEmail: 'chief@college.edu',
        },
      },
    ] as any);

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('forbids students and regular users from accessing audit logs', async () => {
    const studentToken = signToken({
      id: 'student-uuid',
      username: 'regular_student',
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      collegeEmail: 'student@college.edu',
    });

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });
});
