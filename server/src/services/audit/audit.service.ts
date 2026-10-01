import { prisma } from '../../lib/prisma';

export type AuditAction =
  | 'ADMIN_LOGIN'
  | 'STATUS_CHANGE'
  | 'CASE_ASSIGNED'
  | 'OUTCOME_DECIDED'
  | 'ROSTER_IMPORTED'
  | 'IDENTITY_REVEAL_REQUESTED'
  | 'IDENTITY_REVEAL_APPROVED'
  | 'IDENTITY_REVEAL_REJECTED'
  | 'RULE_CREATED'
  | 'RULE_UPDATED'
  | 'RULE_DELETED'
  | 'SLA_POLICY_UPDATED'
  | 'POLICE_STATION_MANAGED'
  | 'USER_STATUS_CHANGED';

export interface CreateAuditLogParams {
  actorId: string;
  action: AuditAction | string;
  entity: string;
  entityId: string;
  meta?: Record<string, any>;
}

export interface GetAuditLogsFilter {
  actorId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Records an immutable audit log entry into the public.audit_logs ledger
 * (ARCHITECTURE.md §11)
 */
export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        meta: params.meta || {},
      },
    });
  } catch (err) {
    // If DB is offline during tests or fallback, gracefully log warning
    console.warn('[AuditLog Warning]: Failed to persist audit log entry:', err);
    return null;
  }
}

/**
 * Retrieves paginated audit logs for compliance reviews (SUPER_ADMIN only)
 */
export async function getAuditLogs(filter: GetAuditLogsFilter = {}) {
  const {
    actorId,
    action,
    entity,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filter;

  const whereClause: any = {};
  if (actorId) whereClause.actorId = actorId;
  if (action) whereClause.action = action;
  if (entity) whereClause.entity = entity;
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) whereClause.createdAt.lte = new Date(endDate);
  }

  try {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: whereClause }),
      prisma.auditLog.findMany({
        where: whereClause,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              role: true,
              collegeEmail: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
    ]);

    return { total, logs, limit, offset };
  } catch (err) {
    console.warn('[AuditLog Query Warning]: DB query failed, returning empty log list:', err);
    return { total: 0, logs: [], limit, offset };
  }
}

/**
 * Aggregates audit log metrics for security oversight
 */
export async function getAuditSummary() {
  try {
    const [totalEvents, actionCounts, recentLogins] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      prisma.auditLog.findMany({
        where: { action: 'ADMIN_LOGIN' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { username: true, role: true, department: true },
          },
        },
      }),
    ]);

    return {
      totalEvents,
      actionDistribution: actionCounts.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
      recentLogins,
    };
  } catch (err) {
    return {
      totalEvents: 0,
      actionDistribution: [],
      recentLogins: [],
    };
  }
}
