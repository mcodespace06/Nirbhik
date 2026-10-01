import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { vaultService } from '../../src/services/vault';
import { signToken } from '../../src/services/auth/tokens';
import { Role, UserStatus, ComplaintMode } from '@prisma/client';

describe('Break-Glass Identity Reveal & Dual Authorization (Phase 8, ARCHITECTURE §5, §11, WORKFLOW §11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const superAdminA = signToken({
    id: 'admin-a-uuid',
    username: 'superadmin_a',
    role: Role.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    collegeEmail: 'admin.a@college.edu',
  });

  const superAdminB = signToken({
    id: 'admin-b-uuid',
    username: 'superadmin_b',
    role: Role.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    collegeEmail: 'admin.b@college.edu',
  });

  const regularAdmin = signToken({
    id: 'admin-c-uuid',
    username: 'regular_admin',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    collegeEmail: 'admin.c@college.edu',
  });

  it('rejects reveal requests for ULTRA_ANON complaints (cryptographic vault isolation)', async () => {
    vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
      id: 'case-ultra-anon',
      mode: ComplaintMode.ULTRA_ANON,
      title: 'Anonymous hazing report',
    } as any);

    const res = await request(app)
      .post('/api/admin/reveal/request')
      .set('Authorization', `Bearer ${superAdminA}`)
      .send({
        complaintId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Investigating critical weapon threat under formal magisterial order.',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ULTRA_ANON_IRREVERSIBLE');
  });

  it('allows Super Admin A to submit a valid break-glass request for CONFIDENTIAL complaints', async () => {
    vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      mode: ComplaintMode.CONFIDENTIAL,
      title: 'Lab hazard sabotage',
    } as any);

    vi.spyOn(prisma.breakGlassRequest, 'create').mockResolvedValue({
      id: 'reveal-req-1',
      complaintId: '550e8400-e29b-41d4-a716-446655440001',
      requestedBy: 'admin-a-uuid',
      reason: 'Formal court order and imminent physical safety hazard',
      status: 'PENDING',
      createdAt: new Date(),
    } as any);

    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/admin/reveal/request')
      .set('Authorization', `Bearer ${superAdminA}`)
      .send({
        complaintId: '550e8400-e29b-41d4-a716-446655440001',
        reason: 'Formal court order and imminent physical safety hazard',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('ENFORCES DUAL AUTHORIZATION: Requester cannot approve their own reveal request', async () => {
    vi.spyOn(prisma.breakGlassRequest, 'findUnique').mockResolvedValue({
      id: 'reveal-req-1',
      complaintId: '550e8400-e29b-41d4-a716-446655440001',
      requestedBy: 'admin-a-uuid', // Requested by Admin A
      status: 'PENDING',
    } as any);

    // Admin A tries to approve their own request -> 403 Forbidden
    const res = await request(app)
      .post('/api/admin/reveal/reveal-req-1/decide')
      .set('Authorization', `Bearer ${superAdminA}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DUAL_AUTH_VIOLATION');
  });

  it('allows Super Admin B to approve, decrypts Vault link, and returns identity', async () => {
    vi.spyOn(prisma.breakGlassRequest, 'findUnique').mockResolvedValue({
      id: 'reveal-req-1',
      complaintId: '550e8400-e29b-41d4-a716-446655440001',
      requestedBy: 'admin-a-uuid', // Requested by A
      status: 'PENDING',
    } as any);

    vi.spyOn(vaultService, 'resolveUserForComplaint').mockResolvedValue('student-victim-uuid');

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'student-victim-uuid',
      username: 'aarav_sharma',
      collegeEmail: 'aarav@college.edu',
      department: 'Computer Science',
      rosterEntry: {
        fullName: 'Aarav Sharma',
        enrollmentNo: 'ENR-2024-001',
        department: 'Computer Science',
      },
    } as any);

    vi.spyOn(prisma.breakGlassRequest, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    // Admin B approves -> Success
    const res = await request(app)
      .post('/api/admin/reveal/reveal-req-1/decide')
      .set('Authorization', `Bearer ${superAdminB}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.revealedIdentity).toBeDefined();
    expect(res.body.revealedIdentity.fullName).toBe('Aarav Sharma');
    expect(res.body.revealedIdentity.enrollmentNo).toBe('ENR-2024-001');
  });

  it('forbids standard Admin (non-Super Admin) from accessing break-glass endpoints', async () => {
    const res = await request(app)
      .post('/api/admin/reveal/request')
      .set('Authorization', `Bearer ${regularAdmin}`)
      .send({
        complaintId: '550e8400-e29b-41d4-a716-446655440001',
        reason: 'Unauthorized attempt',
      });

    expect(res.status).toBe(403);
  });
});
