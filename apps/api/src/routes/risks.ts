/**
 * Risk signal endpoints for Phase 3 (AI 风险监查工作台).
 *
 *   GET    /api/risks                       — list with pagination + filters
 *   GET    /api/risks/:riskId               — detail + handling records + audit chain + linked AIOutput
 *   POST   /api/risks/:riskId/assign        — assign to a user (Open→Assigned)
 *   POST   /api/risks/:riskId/start         — start handling (Assigned→InProgress)
 *   POST   /api/risks/:riskId/resolve       — resolve (InProgress/PendingInvestigator→Resolved, optional reason)
 *   POST   /api/risks/:riskId/close         — close (Resolved→Closed, requires reason; high/critical level enforced)
 *   POST   /api/risks/:riskId/reject        — reject (Open/Assigned→Rejected, requires reason)
 *
 * RBAC: each write goes through domain's Permission matrix (RiskAssign /
 * RiskResolve / RiskClose). Read paths use RiskRead; Auditor / CRA / Sponsor /
 * CRO / SitePI / SiteCRC all hold it. Subject role does not.
 * RiskClose is CROPM-only (SponsorAdmin has RiskResolve but not RiskClose).
 *
 * Lifecycle is guarded by RISK_STATUS_TRANSITIONS. Close + Reject are
 * critical mutations that require a reason (CRITICAL_AUDIT_PAIRS covers it
 * for high/critical levels — for Low/Medium we still write a reason when
 * provided). Every transition writes a RiskHandlingRecord (the operational
 * history) and an AuditEvent (the audit chain). RiskSignal.Confirm is the
 * critical close action; we map "close" to AuditAction.Close to ensure the
 * AuditEvent tuple is in CRITICAL_AUDIT_PAIRS.
 *
 * Start aligns with protocol activate: audit is written before the status
 * mutate so a failed audit cannot leave state half-applied. Close/reject
 * still mutate-then-audit (known debt; not blocking Round 1 Full Pass).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  Permission,
  RiskLevel,
  RiskStatus,
  authorize,
  canTransition,
  RISK_STATUS_TRANSITIONS,
  type RiskStatus as RiskStatusT,
} from "@aic-dct/domain";
import type {
  RiskSignal,
  RiskHandlingRecord,
  AuditEvent,
  AIOutput,
  Subject,
  User,
} from "@prisma/client";
import { prisma } from "../db.js";
import {
  assertProjectAccess,
  audit,
  requireUser,
  resolveActorRoleForProject,
  resolveProjectScope,
  type AuthenticatedUser,
} from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  level: z.nativeEnum(RiskLevel).optional(),
  status: z.nativeEnum(RiskStatus).optional(),
  type: z.string().min(1).max(80).optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const assignSchema = z.object({
  ownerUserId: z.string().min(1),
});

const resolveSchema = z.object({
  reason: z.string().min(1).max(2000).optional(),
});

const closeSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});

function assertRiskTransition(
  from: RiskStatusT,
  to: RiskStatusT,
): void {
  if (!canTransition(RISK_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.STATE_TRANSITION_INVALID,
      `Illegal risk signal transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

/**
 * R1 closure helper: after `loadRiskScoped` resolves the row and confirms
 * project access, re-check the relevant permission against the actor's
 * role on the risk's project. A Sponsor on project A cannot assign /
 * resolve / close / reject a risk on project B using project-A authority.
 */
function authorizeOnRiskProject(
  user: AuthenticatedUser,
  projectId: string,
  permission: Permission,
  requestId: string,
): void {
  const actor = resolveActorRoleForProject(user, projectId, requestId);
  authorize({ userId: actor.userId, role: actor.role }, permission, { requestId });
}

async function loadRiskScoped(
  user: AuthenticatedUser,
  riskId: string,
  requestId: string,
) {
  const risk = await prisma().riskSignal.findUnique({
    where: { id: riskId },
    include: { subject: true, owner: true, aiOutput: true },
  });
  if (!risk) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Risk signal not found",
      { requestId, details: { riskId } },
    );
  }
  // R2: enforce via caller's full role assignment list.
  assertProjectAccess(user, risk.projectId, requestId);
  return risk;
}

export function registerRiskRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/risks",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.RiskRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, level, status, type, ownerId, page, pageSize } =
        parsed.data;
      const scopeProjectId = resolveProjectScope(user, projectId, req.id);
      const where = {
        projectId: scopeProjectId,
        ...(level ? { level } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(ownerId ? { ownerUserId: ownerId } : {}),
      };
      // Most severe first (so the worklist surfaces criticals), then by
      // earliest deadline. Same priority order as the dashboard tasks panel.
      const [rows, total] = await Promise.all([
        prisma().riskSignal.findMany({
          where,
          include: {
            subject: { select: { subjectCode: true } },
            owner: { select: { displayName: true } },
            _count: { select: { handling: true } },
          },
          orderBy: [
            { level: "desc" },
            { deadline: "asc" },
            { createdAt: "desc" },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().riskSignal.count({ where }),
      ]);
      type Row = RiskSignal & {
        subject: Pick<Subject, "subjectCode"> | null;
        owner: Pick<User, "displayName"> | null;
        _count: { handling: number };
      };
      return {
        total,
        page,
        pageSize,
        items: rows.map((row: Row) => ({
          id: row.id,
          level: row.level,
          type: row.type,
          objectType: row.objectType,
          objectId: row.objectId,
          subjectCode: row.subject?.subjectCode ?? null,
          trigger: row.trigger,
          suggestion: row.suggestion ?? null,
          ownerUserId: row.ownerUserId ?? null,
          owner: row.owner?.displayName ?? null,
          deadline: row.deadline ? row.deadline.toISOString() : null,
          status: row.status,
          aiOutputId: row.aiOutputId ?? null,
          handlingCount: row._count.handling,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { riskId: string } }>(
    "/api/risks/:riskId",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.RiskRead, { requestId: req.id });
      const risk = await loadRiskScoped(user, req.params.riskId, req.id);
      const [handling, auditTrail] = await Promise.all([
        prisma().riskHandlingRecord.findMany({
          where: { riskSignalId: risk.id },
          orderBy: { at: "desc" },
          // Role lives on RoleAssignment, not User; fetch via the actor's
          // first assignment to mirror the project-scope the user is acting in.
          include: {
            actor: {
              select: {
                displayName: true,
                roleAssignments: {
                  where: { projectId: risk.projectId },
                  take: 1,
                  orderBy: { assignedAt: "asc" },
                  select: { role: true },
                },
              },
            },
          },
        }),
        prisma().auditEvent.findMany({
          where: { objectType: "RiskSignal", objectId: risk.id },
          orderBy: { timestamp: "desc" },
        }),
      ]);
      type Handle = RiskHandlingRecord & {
        actor: Pick<User, "displayName"> & {
          roleAssignments: ReadonlyArray<{ role: string }>;
        };
      };
      type Trail = AuditEvent;
      return {
        risk: {
          id: risk.id,
          projectId: risk.projectId,
          level: risk.level,
          type: risk.type,
          objectType: risk.objectType,
          objectId: risk.objectId,
          subjectId: risk.subjectId ?? null,
          subjectCode: risk.subject?.subjectCode ?? null,
          trigger: risk.trigger,
          suggestion: risk.suggestion ?? null,
          ownerUserId: risk.ownerUserId ?? null,
          owner: risk.owner?.displayName ?? null,
          deadline: risk.deadline ? risk.deadline.toISOString() : null,
          status: risk.status,
          aiOutputId: risk.aiOutputId ?? null,
          createdAt: risk.createdAt.toISOString(),
          updatedAt: risk.updatedAt.toISOString(),
        },
        aiOutput: risk.aiOutput
          ? serializeAIOutput(risk.aiOutput)
          : null,
        handling: handling.map((h: Handle) => ({
          id: h.id,
          actorName: h.actor.displayName,
          actorRole: h.actor.roleAssignments[0]?.role ?? "Unknown",
          action: h.action,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          reason: h.reason ?? null,
          at: h.at.toISOString(),
        })),
        auditTrail: auditTrail.map((a: Trail) => ({
          id: a.id,
          actorUserId: a.actorUserId,
          actorRole: a.actorRole,
          action: a.action,
          beforeValue: a.beforeValue,
          afterValue: a.afterValue,
          reason: a.reason,
          timestamp: a.timestamp.toISOString(),
        })),
      };
    },
  );

  /* ─── Assign (Open/Assigned → Assigned) ───────────────── */
  app.post<{
    Params: { riskId: string };
    Body: z.infer<typeof assignSchema>;
  }>("/api/risks/:riskId/assign", async (req) => {
    const user = await requireUser(req);
    const risk = await loadRiskScoped(user, req.params.riskId, req.id);
    authorizeOnRiskProject(user, risk.projectId, Permission.RiskAssign, req.id);
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    assertRiskTransition(risk.status, RiskStatus.Assigned);
    const owner = await prisma().user.findUnique({
      where: { id: parsed.data.ownerUserId },
    });
    if (!owner) {
      throw new ApiErrorException(
        ApiErrorCode.NOT_FOUND,
        "Owner user not found",
        { requestId: req.id, details: { userId: parsed.data.ownerUserId } },
      );
    }
    const updated = await prisma().riskSignal.update({
      where: { id: risk.id },
      data: {
        status: RiskStatus.Assigned,
        ownerUserId: parsed.data.ownerUserId,
      },
    });
    await Promise.all([
      prisma().riskHandlingRecord.create({
        data: {
          riskSignalId: risk.id,
          actorUserId: user.userId,
          action: "assign",
          fromStatus: risk.status,
          toStatus: RiskStatus.Assigned,
        },
      }),
      audit(
        req,
        user,
        "assign",
        "RiskSignal",
        updated.id,
        { to: updated.status, ownerUserId: parsed.data.ownerUserId },
        { beforeValue: { status: risk.status, ownerUserId: risk.ownerUserId } },
      ),
    ]);
    return { id: updated.id, status: updated.status, ownerUserId: updated.ownerUserId };
  });

  /* ─── Start (Assigned → InProgress) ───────────────────── */
  app.post<{ Params: { riskId: string } }>(
    "/api/risks/:riskId/start",
    async (req) => {
      const user = await requireUser(req);
      const risk = await loadRiskScoped(user, req.params.riskId, req.id);
      authorizeOnRiskProject(user, risk.projectId, Permission.RiskResolve, req.id);
      assertRiskTransition(risk.status, RiskStatus.InProgress);
      // Audit-before-mutate (protocol activate pattern): ensure the audit
      // chain accepts the transition before flipping status. Start has no
      // required reason, but the ordering still protects against half-applied
      // state if audit persistence fails.
      await audit(
        req,
        user,
        "start",
        "RiskSignal",
        risk.id,
        { to: RiskStatus.InProgress },
        { beforeValue: { status: risk.status } },
      );
      const updated = await prisma().riskSignal.update({
        where: { id: risk.id },
        data: { status: RiskStatus.InProgress },
      });
      await prisma().riskHandlingRecord.create({
        data: {
          riskSignalId: risk.id,
          actorUserId: user.userId,
          action: "start",
          fromStatus: risk.status,
          toStatus: RiskStatus.InProgress,
        },
      });
      return { id: updated.id, status: updated.status };
    },
  );

  /* ─── Resolve (InProgress/PendingInvestigator → Resolved) ── */
  app.post<{
    Params: { riskId: string };
    Body: z.infer<typeof resolveSchema>;
  }>("/api/risks/:riskId/resolve", async (req) => {
    const user = await requireUser(req);
    const risk = await loadRiskScoped(user, req.params.riskId, req.id);
    authorizeOnRiskProject(user, risk.projectId, Permission.RiskResolve, req.id);
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    assertRiskTransition(risk.status, RiskStatus.Resolved);
    const updated = await prisma().riskSignal.update({
      where: { id: risk.id },
      data: { status: RiskStatus.Resolved },
    });
    await Promise.all([
      prisma().riskHandlingRecord.create({
        data: {
          riskSignalId: risk.id,
          actorUserId: user.userId,
          action: "resolve",
          fromStatus: risk.status,
          toStatus: RiskStatus.Resolved,
          reason: parsed.data.reason ?? null,
        },
      }),
      audit(
        req,
        user,
        "resolve",
        "RiskSignal",
        updated.id,
        { to: updated.status },
        {
          beforeValue: { status: risk.status },
          reason: parsed.data.reason,
        },
      ),
    ]);
    return { id: updated.id, status: updated.status };
  });

  /* ─── Close (Resolved → Closed; high/critical requires reason) ── */
  app.post<{
    Params: { riskId: string };
    Body: z.infer<typeof closeSchema>;
  }>("/api/risks/:riskId/close", async (req) => {
    const user = await requireUser(req);
    const risk = await loadRiskScoped(user, req.params.riskId, req.id);
    authorizeOnRiskProject(user, risk.projectId, Permission.RiskClose, req.id);
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    assertRiskTransition(risk.status, RiskStatus.Closed);
    const updated = await prisma().riskSignal.update({
      where: { id: risk.id },
      data: { status: RiskStatus.Closed },
    });
    await Promise.all([
      prisma().riskHandlingRecord.create({
        data: {
          riskSignalId: risk.id,
          actorUserId: user.userId,
          action: "close",
          fromStatus: risk.status,
          toStatus: RiskStatus.Closed,
          reason: parsed.data.reason,
        },
      }),
      // RiskSignal.Close is in CRITICAL_AUDIT_PAIRS with requiresReason:
      // the audit() helper enforces it again as a defense-in-depth check.
      audit(
        req,
        user,
        "close",
        "RiskSignal",
        updated.id,
        { to: updated.status, level: updated.level },
        {
          beforeValue: { status: risk.status, level: risk.level },
          reason: parsed.data.reason,
        },
      ),
    ]);
    return { id: updated.id, status: updated.status };
  });

  /* ─── Reject (Open/Assigned → Rejected; high/critical requires reason) ── */
  app.post<{
    Params: { riskId: string };
    Body: z.infer<typeof rejectSchema>;
  }>("/api/risks/:riskId/reject", async (req) => {
    const user = await requireUser(req);
    const risk = await loadRiskScoped(user, req.params.riskId, req.id);
    authorizeOnRiskProject(user, risk.projectId, Permission.RiskClose, req.id);
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    assertRiskTransition(risk.status, RiskStatus.Rejected);
    const updated = await prisma().riskSignal.update({
      where: { id: risk.id },
      data: { status: RiskStatus.Rejected },
    });
    await Promise.all([
      prisma().riskHandlingRecord.create({
        data: {
          riskSignalId: risk.id,
          actorUserId: user.userId,
          action: "reject",
          fromStatus: risk.status,
          toStatus: RiskStatus.Rejected,
          reason: parsed.data.reason,
        },
      }),
      audit(
        req,
        user,
        "reject",
        "RiskSignal",
        updated.id,
        { to: updated.status, level: updated.level },
        {
          beforeValue: { status: risk.status, level: risk.level },
          reason: parsed.data.reason,
        },
      ),
    ]);
    return { id: updated.id, status: updated.status };
  });
}

function serializeAIOutput(out: AIOutput): Record<string, unknown> {
  return {
    id: out.id,
    kind: out.kind,
    confidence: out.confidence,
    confidenceLevel: out.confidenceLevel,
    status: out.status,
    model: out.model,
    modelVersion: out.modelVersion,
    payload: out.payload,
    generatedAt: out.generatedAt.toISOString(),
    confirmedByUserId: out.confirmedByUserId ?? null,
    confirmedAt: out.confirmedAt ? out.confirmedAt.toISOString() : null,
    notes: out.notes ?? null,
  };
}
