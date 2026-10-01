import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { vaultService } from '../../src/services/vault';
import { signToken } from '../../src/services/auth/tokens';
import { generateTrackingKey, hashTrackingKey } from '../../src/services/complaints/tracking-key';
import { Role, ComplaintStatus, Priority, UserStatus, Outcome, ComplaintMode } from '@prisma/client';

describe('Case Management & Investigation System Workflow (Phases 1 - 5)', () => {
  const adminToken = signToken({
    id: 'admin-investigator-1',
    username: 'inspector_sharma',
    role: Role.ADMIN,
    status: 'ACTIVE',
    collegeEmail: 'sharma.investigation@campus.edu',
  });

  const superAdminToken = signToken({
    id: 'super-admin-sp-1',
    username: 'superintendent_verma',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
    collegeEmail: 'sp.verma@campus.edu',
  });

  const studentToken = signToken({
    id: 'student-victim-1',
    username: 'victim_student',
    role: Role.STUDENT,
    status: 'ACTIVE',
    collegeEmail: 'victim@campus.edu',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PHASE 1: User/Victim Registration & Profiling (Aadhaar OTP + Confidential)
  // =========================================================================
  describe('Phase 1: User/Victim Registration & Profiling', () => {
    it('POST /api/auth/aadhaar/send-otp: issues simulated OTP for 12-digit Aadhaar', async () => {
      const res = await request(app)
        .post('/api/auth/aadhaar/send-otp')
        .send({ aadhaarNumber: '123456789012', phoneOrEmail: '+919876543210' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.maskedRecipient).toBeDefined();
      expect(res.body.message).toContain('Verification OTP dispatched');
    });

    it('POST /api/auth/aadhaar/send-otp: rejects invalid Aadhaar format', async () => {
      const res = await request(app)
        .post('/api/auth/aadhaar/send-otp')
        .send({ aadhaarNumber: '12345', phoneOrEmail: '+919876543210' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AADHAAR_ERROR');
    });

    it('POST /api/auth/aadhaar/verify-otp: successfully verifies OTP code and returns verificationToken', async () => {
      const otpSend = await request(app)
        .post('/api/auth/aadhaar/send-otp')
        .send({ aadhaarNumber: '123456789012', phoneOrEmail: '+919876543210' });
      const currentSessionId = otpSend.body.sessionId;
      const validCode = otpSend.body.devOtp || '123456';

      const res = await request(app)
        .post('/api/auth/aadhaar/verify-otp')
        .send({ sessionId: currentSessionId, otp: validCode });

      expect(res.status).toBe(200);
      expect(res.body.verificationToken).toBeDefined();
      expect(res.body.aadhaarLast4).toBe('9012');
      expect(res.body.message).toContain('Aadhaar identity successfully authenticated');
    });

    it('POST /api/auth/aadhaar/verify-otp: rejects incorrect OTP code', async () => {
      const otpSend = await request(app)
        .post('/api/auth/aadhaar/send-otp')
        .send({ aadhaarNumber: '123456789012', phoneOrEmail: '+919876543210' });
      const currentSessionId = otpSend.body.sessionId;

      const res = await request(app)
        .post('/api/auth/aadhaar/verify-otp')
        .send({ sessionId: currentSessionId, otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VERIFICATION_FAILED');
    });

    it('POST /api/auth/register: stores encrypted confidential profile during user registration', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.collegeRoster, 'findFirst').mockResolvedValue({
        id: 'roster-victim-1',
        enrollmentNo: 'EN2026999',
        fullName: 'Priya Kumari',
        collegeEmail: 'priya.k@campus.edu',
        role: Role.STUDENT,
        department: 'Electronics',
        claimed: false,
        createdAt: new Date(),
      });

      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'user-priya-uuid',
        username: 'priya_k',
        passwordHash: 'argon2_hashed',
        role: Role.STUDENT,
        collegeEmail: 'priya.k@campus.edu',
        rosterId: 'roster-victim-1',
        status: UserStatus.PENDING_VERIFY,
        department: 'Electronics',
        phone: '+919876543210',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.verificationRequest, 'create').mockResolvedValue({
        id: 'verif-priya',
        userId: 'user-priya-uuid',
        method: 'ROSTER_OTP',
        otpHash: 'hashed_otp',
        otpExpires: new Date(Date.now() + 600000),
        idCardFileKey: null,
        status: 'PENDING',
        reviewedBy: null,
        rejectionReason: null,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'priya_k',
          password: 'Password@123',
          enrollmentNo: 'EN2026999',
          collegeEmail: 'priya.k@campus.edu',
          legalName: 'Priya Kumari',
          phone: '+919876543210',
          address: 'Room 204, South Girls Hostel, Campus',
          aadhaarNumber: '123456789012',
          aadhaarToken: 'mock-aadhaar-verified-token',
        });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe('user-priya-uuid');
      expect(res.body.method).toBe('ROSTER_OTP');
    });
  });

  // =========================================================================
  // PHASE 2: AI Case Analyzer (Pre-Filing & Triage)
  // =========================================================================
  describe('Phase 2: AI Case Analyzer (Pre-Filing & Triage)', () => {
    it('POST /api/assistant/case-analyze: analyzes incident story, identifies broken Indian laws, and drafts formal FIR', async () => {
      const res = await request(app)
        .post('/api/assistant/case-analyze')
        .send({
          story: 'On Monday night in North Hostel, three senior students stopped me, used abusive language, threatened physical assault if I refused their chores, and snatched my hostel ID card.',
          category: 'Ragging',
        });

      expect(res.status).toBe(200);

      // Verify Mandatory Disclaimer
      expect(res.body.disclaimer).toBeDefined();
      expect(res.body.disclaimer).toContain('MANDATORY LEGAL NOTICE');
      expect(res.body.disclaimer).toContain('does not constitute certified legal counsel');

      // Verify Legal Triage & Broken Laws
      expect(res.body.guidance).toBeDefined();
      expect(res.body.brokenLaws).toBeInstanceOf(Array);
      expect(res.body.brokenLaws.length).toBeGreaterThan(0);

      // Verify BNS and UGC Anti-Ragging sections
      const acts = res.body.brokenLaws.map((l: any) => l.act);
      expect(acts.some((act: string) => act.includes('Bharatiya Nyaya Sanhita') || act.includes('UGC'))).toBe(true);

      // Verify Bailable and Cognizable flags
      const firstLaw = res.body.brokenLaws[0];
      expect(typeof firstLaw.bailable).toBe('boolean');
      expect(typeof firstLaw.cognizable).toBe('boolean');

      // Verify Resolution Paths
      expect(res.body.immediateActions).toBeInstanceOf(Array);
      expect(res.body.resolutionPaths).toBeInstanceOf(Array);

      // Verify Formal FIR Draft (BNSS §173 / CrPC §154 format)
      expect(res.body.firDraft).toBeDefined();
      expect(res.body.firDraft).toContain('FIRST INFORMATION REPORT');
      expect(res.body.firDraft).toContain('Bharatiya Nagarik Suraksha Sanhita');
      expect(res.body.firDraft).toContain('DRAFT');
    });
  });

  // =========================================================================
  // PHASE 3: New Complaint Registration (Incident Timeline & Accused Replicator)
  // =========================================================================
  describe('Phase 3: New Complaint Registration', () => {
    it('POST /api/complaints: accepts accused roster with roles, handles, proof, and FIR draft', async () => {
      const validKey = generateTrackingKey();
      const validKeyHash = hashTrackingKey(validKey);

      vi.spyOn(prisma.category, 'findUnique').mockResolvedValue({
        id: 'cat-ragging-1',
        name: 'Ragging',
        severityWeight: 40,
        routesToQueue: null,
        isSafety: true,
      } as any);

      vi.spyOn(prisma.location, 'findUnique').mockResolvedValue({
        id: 'loc-north-hostel',
        name: 'North Campus Boys Hostel',
      } as any);

      const fakeComplaint = {
        id: 'case-workflow-uuid-1',
        title: 'Ragging and physical intimidation in corridor',
        description: 'Encountered seniors demanding chores and issuing verbal assault.',
        categoryId: 'cat-ragging-1',
        locationId: 'loc-north-hostel',
        incidentAt: new Date('2026-10-01T22:30:00Z'),
        mode: ComplaintMode.CONFIDENTIAL,
        status: ComplaintStatus.SUBMITTED,
        priority: Priority.HIGH,
        pseudonym: 'Complainant #A1B2',
        trackingKeyHash: validKeyHash,
        trackingKeySalt: 'salt',
        restrictedQueue: null,
        targetEntityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { create: vi.fn().mockResolvedValue(fakeComplaint) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
          riskAlert: { create: vi.fn().mockResolvedValue({}) },
          attachment: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      // Mock isolated vault reporter link so it doesn't query real DB
      vi.spyOn(vaultService, 'linkReporter').mockResolvedValue();

      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Ragging and physical intimidation in corridor',
          description: 'Encountered seniors demanding chores and issuing verbal assault.',
          categoryId: 'cat-ragging-1',
          locationId: 'loc-north-hostel',
          incidentAt: '2026-10-01T22:30:00.000Z',
          mode: 'CONFIDENTIAL',
          firDraft: 'FORMAL FIR DRAFT: Incident occurred at North Campus Boys Hostel...',
          accusedList: [
            {
              name: 'Rahul Mehra',
              role: 'PRIMARY_ACCUSED',
              onlineHandles: '@rahul_m_campus',
              proof: 'Audio recording from corridor',
            },
            {
              name: 'Vikas Taneja',
              role: 'ACCOMPLICE',
              onlineHandles: '@vikas_t',
              proof: 'Eyewitness testimony from roommate',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.complaintId).toBe('case-workflow-uuid-1');
      expect(res.body.trackingKey).toBeDefined();
      expect(res.body.pseudonym).toBeDefined();
      expect(res.body.mode).toBe('CONFIDENTIAL');
    });
  });

  // =========================================================================
  // PHASE 4: Victim Dashboard & Case Tracking
  // =========================================================================
  describe('Phase 4: Victim Dashboard & Case Tracking', () => {
    // Generate an authentic Luhn/Crockford validated tracking key
    const testKey = generateTrackingKey();

    it('GET /api/track/:key: retrieves case with accusedList and firDraft in initial payload', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        title: 'Ragging and intimidation',
        description: 'Original complaint narrative.',
        pseudonym: 'Complainant #A1B2',
        status: ComplaintStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        incidentAt: new Date(),
        createdAt: new Date(),
        category: { name: 'Ragging' },
        location: { name: 'North Campus Boys Hostel' },
        attachments: [],
        events: [
          {
            id: 'ev-sub',
            type: 'SUBMITTED',
            actorRole: Role.STUDENT,
            payload: {
              firDraft: 'FORMAL FIR DRAFT BNSS §173',
              accusedList: [{ name: 'Rahul Mehra', role: 'PRIMARY_ACCUSED', onlineHandles: '@rahul_m_campus' }],
            },
            createdAt: new Date(),
          },
        ],
        messages: [],
      } as any);

      const res = await request(app).get(`/api/track/${testKey}`);
      expect(res.status).toBe(200);
      expect(res.body.complaint.title).toBe('Ragging and intimidation');
      expect(res.body.complaint.events[0].payload.firDraft).toContain('FORMAL FIR DRAFT');
      expect(res.body.complaint.events[0].payload.accusedList[0].name).toBe('Rahul Mehra');
    });

    it('POST /api/track/:key/amendments: appends mid-investigation versioned updates (v1.1, v1.2) preserving original complaint', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        events: [], // 0 prior amendments -> next is v1.1
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaintEvent: {
            create: vi.fn().mockResolvedValue({
              id: 'ev-amend-1',
              type: 'AMENDMENT_APPENDED',
              payload: { version: 'v1.1', statement: 'CCTV footage confirmed at 11:30 PM outside corridor.' },
            }),
          },
          attachment: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post(`/api/track/${testKey}/amendments`)
        .send({
          statement: 'CCTV footage confirmed at 11:30 PM outside corridor.',
          attachments: [{ fileKey: 'evidence/cctv-1130.mp4', name: 'cctv.mp4', size: 2048, mime: 'video/mp4' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.version).toBe('v1.1');
      expect(res.body.message).toContain('Original complaint remains tamper-evident');
    });

    it('POST /api/track/:key/escalate: triggers formal higher-level appeal workflow for unsatisfied victims', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { update: vi.fn().mockResolvedValue({}) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          riskAlert: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post(`/api/track/${testKey}/escalate`)
        .send({
          appealReason: 'No visible disciplinary action taken against the accused after 14 days.',
          groundsForAppeal: 'Breach of mandatory UGC Anti-Ragging 7-day inquiry SLA.',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ComplaintStatus.ESCALATED);
      expect(res.body.message).toContain('Case escalated to Higher Oversight Authority');
    });

    it('POST /api/track/:key/reactivate: reopens closed case when new critical evidence emerges', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { update: vi.fn().mockResolvedValue({}) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post(`/api/track/${testKey}/reactivate`)
        .send({
          reason: 'Accused student approached me again in the university library despite previous warning.',
          newEvidenceNotes: 'Library logbook timestamped 2026-10-02 14:00.',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ComplaintStatus.REOPENED);
      expect(res.body.message).toContain('Case reactivated');
    });

    it('GET /api/track/:key/dossier: exports complete certified investigation dossier pack', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
        title: 'Ragging in corridor',
        category: { name: 'Ragging' },
        location: { name: 'North Campus Boys Hostel' },
        incidentAt: new Date(),
        createdAt: new Date(),
        resolvedAt: new Date(),
        status: ComplaintStatus.RESOLVED,
        priority: Priority.HIGH,
        mode: 'CONFIDENTIAL',
        outcome: Outcome.VALID,
        outcomeReason: 'Disciplinary suspension issued.',
        attachments: [],
        events: [
          {
            id: 'ev-sub',
            type: 'SUBMITTED',
            actorRole: Role.STUDENT,
            payload: { firDraft: 'FORMAL FIR DRAFT' },
            createdAt: new Date(),
          },
        ],
        messages: [],
      } as any);

      const res = await request(app).get(`/api/track/${testKey}/dossier`);
      expect(res.status).toBe(200);
      expect(res.body.dossier).toBeDefined();
      expect(res.body.dossier.metadata.securityClassification).toBe('CONFIDENTIAL EVIDENTIARY RECORD');
      expect(res.body.dossier.caseSummary.outcome).toBe(Outcome.VALID);
      expect(res.body.dossier.completeAuditTimeline).toBeInstanceOf(Array);
      expect(res.body.dossier.appendOnlyAmendments).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // PHASE 5: Police Investigation Workflow
  // =========================================================================
  describe('Phase 5: Police Investigation Workflow', () => {
    it('GET /api/admin/cases/:id/correlations: queries Central DB and correlates accused handles & profiles', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        locationId: 'loc-north-hostel',
        categoryId: 'cat-ragging-1',
        events: [
          {
            type: 'SUBMITTED',
            payload: {
              accusedList: [
                {
                  name: 'Rahul Mehra',
                  onlineHandles: '@rahul_m_campus',
                },
              ],
            },
          },
        ],
      } as any);

      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'case-past-99',
          pseudonym: 'Complainant #X9Y8',
          title: 'Verbal harassment near hostel',
          locationId: 'loc-north-hostel',
          categoryId: 'cat-ragging-1',
          status: ComplaintStatus.RESOLVED,
          priority: Priority.MEDIUM,
          createdAt: new Date(),
          category: { name: 'Ragging' },
          location: { name: 'North Campus Boys Hostel' },
          events: [
            {
              type: 'SUBMITTED',
              payload: {
                accusedList: [
                  {
                    name: 'Rahul Mehra',
                    onlineHandles: '@rahul_m_campus',
                  },
                ],
              },
            },
          ],
        } as any,
      ]);

      const res = await request(app)
        .get('/api/admin/cases/case-workflow-uuid-1/correlations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalCorrelationsFound).toBe(1);
      expect(res.body.disclaimer).toContain('HUMAN-IN-THE-LOOP MANDATE');
      expect(res.body.correlations[0].caseId).toBe('case-past-99');
      expect(res.body.correlations[0].matchConfidence).toBeGreaterThanOrEqual(88);
      expect(res.body.correlations[0].reasons.some((r: string) => r.includes('Rahul Mehra'))).toBe(true);
    });

    it('POST /api/admin/cases/:id/correlations/sign-off: performs explicit officer sign-off to formally link cases', async () => {
      vi.spyOn(prisma.complaint, 'findUnique')
        .mockResolvedValueOnce({ id: 'case-workflow-uuid-1', pseudonym: 'Complainant #A1B2' } as any)
        .mockResolvedValueOnce({ id: 'case-past-99', pseudonym: 'Complainant #X9Y8' } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-workflow-uuid-1/correlations/sign-off')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          correlatedCaseId: 'case-past-99',
          officerBadgeNo: 'MH-POLICE-7821',
          reasonNotes: 'Confirmed physical identity and handle match @rahul_m_campus across complaints.',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Officer Sign-Off completed');
      expect(res.body.message).toContain('formally linked');
    });

    it('POST /api/admin/cases/:id/submit-for-approval: submits case decision to supervisor approval gate', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { update: vi.fn().mockResolvedValue({}) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          riskAlert: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-workflow-uuid-1/submit-for-approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          proposedActionTaken: 'Issue official show-cause notice and order 1-semester hostel debarment.',
          proposedOutcome: Outcome.VALID,
          supervisorNotes: 'Sufficient CCTV and audio correlation established.',
          proofDocumentKey: 'evidence/inquiry-report-final.pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ComplaintStatus.FLAGGED_REVIEW);
      expect(res.body.message).toContain('submitted to Superior Officer');
    });

    it('POST /api/admin/cases/:id/supervisor-decide: superior officer grants approval and resolves case', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { update: vi.fn().mockResolvedValue({}) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-workflow-uuid-1/supervisor-decide')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          decision: 'APPROVE',
          feedbackNotes: 'Quality control approved. Punishment order legally validated under UGC Regulation 9.1.',
          finalOutcome: Outcome.VALID,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ComplaintStatus.RESOLVED);
      expect(res.body.message).toContain('Supervisor Approval Granted');
    });

    it('POST /api/admin/cases/:id/action-taken: records official action taken, proof upload, and publishes written ATR', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-workflow-uuid-1',
        pseudonym: 'Complainant #A1B2',
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          attachment: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-workflow-uuid-1/action-taken')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          actionTakenText: 'Primary accused Rahul Mehra suspended for 1 semester; accomplice issued written warning and mandatory counselling.',
          proofFileKey: 'proof/disciplinary-order-2026-44.pdf',
          disciplinaryOrders: 'Suspension for Term 1, AY 2026-27.',
          policeFirRegistered: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Written Action Taken Report (ATR) generated');
      expect(res.body.recordedAt).toBeDefined();
    });
  });
});
