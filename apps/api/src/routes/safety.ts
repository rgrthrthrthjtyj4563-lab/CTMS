/**
 * Safety event endpoints for Phase 3 (AE/SAE workflow).
 *
 *   GET    /api/safety/events                  — list with pagination + filters
 *   GET    /api/safety/events/:eventId         — detail + followUps + audit trail
 *   POST   /api/safety/events                  — create AE (Draft default)
 *   POST   /api/safety/events/:eventId/confirm — PI confirm (Draft → ConfirmedAE/SAE)
 *   POST   /api/safety/events/:eventId/report  — PI report SAE (ConfirmedSAE → Reported)
 *   POST   /api/safety/events/:eventId/follow-up — append follow-up record only
 *   POST   /api/safety/events/:eventId/close   — close (any active → Closed)
 *
 * RBAC: each endpoint goes through domain's Permission matrix (SafetyRead /
 * SafetyDraft / SafetyConfirm / SafetyReport / SafetyClose). Subject role is
 * not granted SafetyRead so it cannot list/read safety data.
 *
 * Lifecycle is guarded by SAFETY_EVENT_TRANSITIONS. Critical mutations
 * (Confirm/Report/Close) write AuditEvent with beforeValue; Report/Close
 * require a server-validated reason (audit helper enforces REASON_REQUIRED).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  Permission,
  RiskLevel,
  SafetyEventStatus,
  authorize,
  canTransition,
  SAFETY_EVENT_TRANSITIONS,
  type SafetyEventStatus as SafetyEventStatusT,
} from "@aic-dct/domain";
import type {
  SafetyEvent,
  SafetyFollowUp,
  AuditEvent,
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
  subjectId: z.string().optional(),
  status: z.nativeEnum(SafetyEventStatus).optional(),
  severity: z.nativeEnum(RiskLevel).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  subjectId: z.string().min(1),
  onsetAt: z.string().datetime(),
  description: z.string().min(1).max(2000),
  severity: z.nativeEnum(RiskLevel),
  isSerious: z.boolean().optional(),
});

const confirmSchema = z.object({
  outcome: z.nativeEnum(SafetyEventStatus),
  isSerious: z.boolean().optional(),
});

const reportSchema = z.object({
  reason: z.string().min(1).max(2000),
  regulator: z.string().max(120).optional(),
});

const followUpSchema = z.object({
  outcome: z.string().min(1).max(2000),
  followUpAt: z.string().datetime().optional(),
});

const closeSchema = z.object({
  reason: z.string().min(1).max(2000),
});

function assertSafetyTransition(
  from: SafetyEventStatusT,
  to: SafetyEventStatusT,
): void {
  if (!canTransition(SAFETY_EVENT_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.STATE_TRANSITION_INVALID,
      `Illegal safety event transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

async function loadEventScoped(
  user: AuthenticatedUser,
  eventId: string,
  requestId: string,
) {
  const event = await prisma().safetyEvent.findUnique({
    where: { id: eventId },
    include: { subject: true, createdBy: true },
  });
  if (!event) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Safety event not found",
      { requestId, details: { eventId } },
    );
  }
  // R2: enforce via the caller's full role assignment list (not the
  // single primary project).
  assertProjectAccess(user, event.projectId, requestId);
  return event;
}

/**
 * R1 closure helper: after `loadEventScoped` resolves the event row and
 * confirms project access, re-check the relevant permission against the
 * actor's role on the event's project. This prevents a Sponsor on
 * project A from confirming an event that lives in project B.
 */
function authorizeOnProject(
  user: AuthenticatedUser,
  projectId: string,
  permission: Permission,
  requestId: string,
): void {
  const actor = resolveActorRoleForProject(user, projectId, requestId);
  authorize({ userId: actor.userId, role: actor.role }, permission, { requestId });
}

export function registerSafetyRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/safety/events",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.SafetyRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, subjectId, status, severity, page, pageSize } = parsed.data;
      const scopeProjectId = resolveProjectScope(user, projectId, req.id);
      const where = {
        projectId: scopeProjectId,
        ...(subjectId ? { subjectId } : {}),
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
      };
      // Severity descending (most severe first), then most recent onset. This
      // puts Critical/High events at the top of the investigator's queue.
      const [rows, total] = await Promise.all([
        prisma().safetyEvent.findMany({
          where,
          include: {
            subject: { select: { subjectCode: true } },
            createdBy: { select: { displayName: true } },
            _count: { select: { followUps: true } },
          },
          orderBy: [{ severity: "desc" }, { onsetAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().safetyEvent.count({ where }),
      ]);
      type Row = SafetyEvent & {
        subject: Pick<Subject, "subjectCode">;
        createdBy: Pick<User, "displayName"> | null;
        _count: { followUps: number };
      };
      return {
        total,
        page,
        pageSize,
        items: rows.map((row: Row) => ({
          id: row.id,
          subjectId: row.subjectId,
          subjectCode: row.subject.subjectCode,
          onsetAt: row.onsetAt.toISOString(),
          description: row.description,
          severity: row.severity,
          isSerious: row.isSerious,
          status: row.status,
          aiSuggested: row.aiSuggested,
          followUpCount: row._count.followUps,
          createdBy: row.createdBy?.displayName ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { eventId: string } }>(
    "/api/safety/events/:eventId",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.SafetyRead, { requestId: req.id });
      const event = await loadEventScoped(user, req.params.eventId, req.id);
      const [followUps, auditTrail] = await Promise.all([
        prisma().safetyFollowUp.findMany({
          where: { safetyEventId: event.id },
          orderBy: { followUpAt: "desc" },
          include: { recordedBy: { select: { displayName: true } } },
        }),
        prisma().auditEvent.findMany({
          where: { objectType: "SafetyEvent", objectId: event.id },
          orderBy: { timestamp: "desc" },
        }),
      ]);
      type FollowUp = SafetyFollowUp & { recordedBy: Pick<User, "displayName"> };
      type Trail = AuditEvent;
      return {
        event: {
          id: event.id,
          subjectId: event.subjectId,
          subjectCode: event.subject.subjectCode,
          projectId: event.projectId,
          onsetAt: event.onsetAt.toISOString(),
          description: event.description,
          severity: event.severity,
          isSerious: event.isSerious,
          aiSuggested: event.aiSuggested,
          status: event.status,
          createdBy: event.createdBy?.displayName ?? null,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
        followUps: followUps.map((f: FollowUp) => ({
          id: f.id,
          followUpAt: f.followUpAt.toISOString(),
          outcome: f.outcome,
          recordedBy: f.recordedBy.displayName,
          createdAt: f.createdAt.toISOString(),
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

  /* ─── Create (Draft) ──────────────────────────────────── */
  app.post<{ Body: z.infer<typeof createSchema> }>(
    "/api/safety/events",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.SafetyDraft, { requestId: req.id });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const subject = await prisma().subject.findUnique({
        where: { id: parsed.data.subjectId },
      });
      if (!subject) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Subject not found",
          { requestId: req.id, details: { subjectId: parsed.data.subjectId } },
        );
      }
      // R2: enforce via caller's role assignment list.
      assertProjectAccess(user, subject.projectId, req.id);
      // R1: draft permission evaluated against the actor's role on the
      // subject's project (NOT the primary project role).
      const draftActor = resolveActorRoleForProject(user, subject.projectId, req.id);
      authorize(
        { userId: draftActor.userId, role: draftActor.role },
        Permission.SafetyDraft,
        { requestId: req.id },
      );
      const created = await prisma().safetyEvent.create({
        data: {
          projectId: subject.projectId,
          subjectId: parsed.data.subjectId,
          onsetAt: new Date(parsed.data.onsetAt),
          description: parsed.data.description,
          severity: parsed.data.severity,
          status: SafetyEventStatus.Draft,
          isSerious: parsed.data.isSerious ?? false,
          createdByUserId: user.userId,
        },
      });
      await audit(
        req,
        user,
        "create",
        "SafetyEvent",
        created.id,
        {
          subjectId: created.subjectId,
          severity: created.severity,
          isSerious: created.isSerious,
        },
        { beforeValue: null },
      );
      return { id: created.id, status: created.status };
    },
  );

  /* ─── Confirm (PI / Sponsor / SystemAdmin) ─────────────── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof confirmSchema>;
  }>("/api/safety/events/:eventId/confirm", async (req) => {
    const user = await requireUser(req);
    const event = await loadEventScoped(user, req.params.eventId, req.id);
    authorizeOnProject(user, event.projectId, Permission.SafetyConfirm, req.id);
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    if (
      parsed.data.outcome !== SafetyEventStatus.ConfirmedAE &&
      parsed.data.outcome !== SafetyEventStatus.ConfirmedSAE
    ) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        `Confirm outcome must be ConfirmedAE or ConfirmedSAE`,
        { requestId: req.id, details: { outcome: parsed.data.outcome } },
      );
    }
    if (event.status !== SafetyEventStatus.Draft) {
      throw new ApiErrorException(
        ApiErrorCode.STATE_TRANSITION_INVALID,
        `Only Draft events can be confirmed (current: ${event.status})`,
        { requestId: req.id, details: { from: event.status, to: parsed.data.outcome } },
      );
    }
    assertSafetyTransition(event.status, parsed.data.outcome);
    const updated = await prisma().safetyEvent.update({
      where: { id: event.id },
      data: {
        status: parsed.data.outcome,
        isSerious:
          parsed.data.outcome === SafetyEventStatus.ConfirmedSAE
            ? true
            : parsed.data.isSerious ?? event.isSerious,
      },
    });
    await audit(
      req,
      user,
      "confirm",
      "SafetyEvent",
      updated.id,
      {
        from: event.status,
        to: updated.status,
        isSerious: updated.isSerious,
      },
      { beforeValue: { status: event.status, isSerious: event.isSerious } },
    );
    return {
      id: updated.id,
      status: updated.status,
      isSerious: updated.isSerious,
    };
  });

  /* ─── Report SAE (PI / Sponsor / SystemAdmin; reason required) ── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof reportSchema>;
  }>("/api/safety/events/:eventId/report", async (req) => {
    const user = await requireUser(req);
    const event = await loadEventScoped(user, req.params.eventId, req.id);
    authorizeOnProject(user, event.projectId, Permission.SafetyReport, req.id);
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    if (!event.isSerious) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Only serious events (SAE) can be reported to regulators",
        { requestId: req.id, details: { eventId: event.id } },
      );
    }
    assertSafetyTransition(event.status, SafetyEventStatus.Reported);
    const updated = await prisma().safetyEvent.update({
      where: { id: event.id },
      data: { status: SafetyEventStatus.Reported },
    });
    // audit() helper enforces REASON_REQUIRED via criticalActionMeta.
    await audit(
      req,
      user,
      "report",
      "SafetyEvent",
      updated.id,
      {
        to: updated.status,
        regulator: parsed.data.regulator ?? null,
      },
      {
        beforeValue: { status: event.status },
        reason: parsed.data.reason,
      },
    );
    return { id: updated.id, status: updated.status };
  });

  /* ─── Follow-up: append-only record, does NOT change status ─────── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof followUpSchema>;
  }>("/api/safety/events/:eventId/follow-up", async (req) => {
    const user = await requireUser(req);
    const event = await loadEventScoped(user, req.params.eventId, req.id);
    authorizeOnProject(user, event.projectId, Permission.SafetyDraft, req.id);
    const parsed = followUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    if (event.status === SafetyEventStatus.Closed) {
      throw new ApiErrorException(
        ApiErrorCode.STATE_TRANSITION_INVALID,
        "Cannot record follow-up on a closed event",
        { requestId: req.id, details: { eventId: event.id } },
      );
    }
    const followUpAt = parsed.data.followUpAt
      ? new Date(parsed.data.followUpAt)
      : new Date();
    const fu = await prisma().safetyFollowUp.create({
      data: {
        safetyEventId: event.id,
        followUpAt,
        outcome: parsed.data.outcome,
        recordedByUserId: user.userId,
      },
    });
    // No status mutation: follow-up is append-only. Reported/ConfirmedSAE
    // events stay Reported/ConfirmedSAE even as follow-ups accumulate.
    await audit(
      req,
      user,
      "safety-event.follow-up",
      "SafetyEvent",
      event.id,
      {
        followUpId: fu.id,
        statusSnapshot: event.status,
      },
      { beforeValue: { status: event.status } },
    );
    return {
      id: fu.id,
      followUpAt: fu.followUpAt.toISOString(),
      outcome: fu.outcome,
      status: event.status,
    };
  });

  /* ─── Close (PI / Sponsor / SystemAdmin; reason required) ── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof closeSchema>;
  }>("/api/safety/events/:eventId/close", async (req) => {
    const user = await requireUser(req);
    const event = await loadEventScoped(user, req.params.eventId, req.id);
    authorizeOnProject(user, event.projectId, Permission.SafetyClose, req.id);
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    if (event.status === SafetyEventStatus.Closed) {
      throw new ApiErrorException(
        ApiErrorCode.STATE_TRANSITION_INVALID,
        "Event is already closed",
        { requestId: req.id, details: { eventId: event.id } },
      );
    }
    assertSafetyTransition(event.status, SafetyEventStatus.Closed);
    const updated = await prisma().safetyEvent.update({
      where: { id: event.id },
      data: { status: SafetyEventStatus.Closed },
    });
    await audit(
      req,
      user,
      "close",
      "SafetyEvent",
      updated.id,
      { to: updated.status },
      {
        beforeValue: { status: event.status },
        reason: parsed.data.reason,
      },
    );
    return { id: updated.id, status: updated.status };
  });
}