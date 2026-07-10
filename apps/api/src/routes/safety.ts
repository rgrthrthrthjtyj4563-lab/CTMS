/**
 * Safety event endpoints for Phase 3 (AE/SAE workflow).
 *
 *   GET    /api/safety/events                  — list with pagination + filters
 *   GET    /api/safety/events/:eventId         — detail + followUps + audit trail
 *   POST   /api/safety/events                  — create AE (Draft default)
 *   POST   /api/safety/events/:eventId/confirm — PI confirm (Draft → ConfirmedAE/SAE)
 *   POST   /api/safety/events/:eventId/report  — PI report SAE (ConfirmedSAE → Reported)
 *   POST   /api/safety/events/:eventId/follow-up — PI/CRC follow-up
 *   POST   /api/safety/events/:eventId/close   - PI close (Confirmed-AE / Reported / FollowUp to Closed)
 *
 * Lifecycle is guarded by SAFETY_EVENT_TRANSITIONS. Critical mutations
 * (Confirm/Report/Close) write AuditEvent; Report/Close require a
 * server-validated reason (CRITICAL_AUDIT_PAIRS).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  Role,
  RiskLevel,
  SafetyEventStatus,
  canTransition,
  SAFETY_EVENT_TRANSITIONS,
  type SafetyEventStatus as SafetyEventStatusT,
} from "@aic-dct/domain";
import {
  Prisma,
  type SafetyEvent,
  type SafetyFollowUp,
  type AuditEvent,
  type Subject,
  type User,
} from "@prisma/client";
import { prisma } from "../db.js";
import {
  audit,
  requireUser,
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
  outcome: z.nativeEnum(SafetyEventStatus), // ConfirmedAE | ConfirmedSAE
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

const ROLES_THAT_CAN_DRAFT: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.ProviderNurse,
  Role.SponsorAdmin,
  Role.CROPM,
  Role.SystemAdmin,
]);

const ROLES_THAT_CAN_CONFIRM: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

const ROLES_THAT_CAN_REPORT_OR_CLOSE: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

function assertRole(
  user: AuthenticatedUser,
  allowed: ReadonlySet<Role>,
  action: string,
  requestId: string,
): void {
  if (!allowed.has(user.role)) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      `Role '${user.role}' cannot ${action}`,
      { requestId, details: { role: user.role } },
    );
  }
}

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
) {
  const event = await prisma().safetyEvent.findUnique({
    where: { id: eventId },
    include: { subject: true, createdBy: true },
  });
  if (!event) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Safety event not found",
      { details: { eventId } },
    );
  }
  if (event.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Safety event belongs to a different project",
      { details: { eventId } },
    );
  }
  return event;
}

async function writeAuditWithReason(args: {
  projectId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  objectId: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  reason: string;
  requestId: string;
}): Promise<void> {
  await prisma().auditEvent.create({
    data: {
      projectId: args.projectId,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      action: args.action,
      objectType: "SafetyEvent",
      objectId: args.objectId,
      beforeValue: (args.beforeValue ?? null) as Prisma.InputJsonValue | undefined,
      afterValue: (args.afterValue ?? null) as Prisma.InputJsonValue | undefined,
      reason: args.reason,
      requestId: args.requestId,
    },
  });
}

export function registerSafetyRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/safety/events",
    async (req) => {
      const user = await requireUser(req);
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, subjectId, status, severity, page, pageSize } = parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
        ...(subjectId ? { subjectId } : {}),
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().safetyEvent.findMany({
          where,
          include: {
            subject: { select: { subjectCode: true } },
            createdBy: { select: { displayName: true } },
            _count: { select: { followUps: true } },
          },
          orderBy: [{ status: "asc" }, { onsetAt: "desc" }],
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
      const event = await loadEventScoped(user, req.params.eventId);
      const [followUps, auditTrail] = await Promise.all([
        prisma().safetyFollowUp.findMany({
          where: { safetyEventId: event.id },
          orderBy: { followUpAt: "desc" },
          include: { recordedBy: { select: { displayName: true } } },
        }),
        prisma().auditEvent.findMany({
          where: { objectType: "SafetyEvent", objectId: event.id },
          orderBy: { timestamp: "desc" },
          take: 50,
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
      assertRole(user, ROLES_THAT_CAN_DRAFT, "draft safety events", req.id);
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
      if (!subject || subject.projectId !== user.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Subject not found in current project",
          { requestId: req.id, details: { subjectId: parsed.data.subjectId } },
        );
      }
      const created = await prisma().safetyEvent.create({
        data: {
          projectId: user.projectId,
          subjectId: parsed.data.subjectId,
          onsetAt: new Date(parsed.data.onsetAt),
          description: parsed.data.description,
          severity: parsed.data.severity,
          status: SafetyEventStatus.Draft,
          isSerious: parsed.data.isSerious ?? false,
          createdByUserId: user.userId,
        },
      });
      await audit(req, user, "safety-event.create", "SafetyEvent", created.id, {
        subjectId: created.subjectId,
        severity: created.severity,
        isSerious: created.isSerious,
      });
      return { id: created.id, status: created.status };
    },
  );

  /* ─── Confirm (PI / Sponsor / SystemAdmin) ─────────────── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof confirmSchema>;
  }>("/api/safety/events/:eventId/confirm", async (req) => {
    const user = await requireUser(req);
    assertRole(user, ROLES_THAT_CAN_CONFIRM, "confirm safety events", req.id);
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
    const event = await loadEventScoped(user, req.params.eventId);
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
    await audit(req, user, "confirm", "SafetyEvent", updated.id, {
      from: event.status,
      to: updated.status,
      isSerious: updated.isSerious,
    });
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
    assertRole(user, ROLES_THAT_CAN_REPORT_OR_CLOSE, "report SAEs", req.id);
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const event = await loadEventScoped(user, req.params.eventId);
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
    await writeAuditWithReason({
      projectId: event.projectId,
      actorUserId: user.userId,
      actorRole: user.role,
      action: "report",
      objectId: event.id,
      beforeValue: { status: event.status },
      afterValue: {
        status: updated.status,
        regulator: parsed.data.regulator ?? null,
      },
      reason: parsed.data.reason,
      requestId: req.id,
    });
    return { id: updated.id, status: updated.status };
  });

  /* ─── Follow-up (PI / CRC / Sponsor) ──────────────────── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof followUpSchema>;
  }>("/api/safety/events/:eventId/follow-up", async (req) => {
    const user = await requireUser(req);
    if (!ROLES_THAT_CAN_DRAFT.has(user.role)) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        `Role ${user.role} cannot record follow-ups`,
        { requestId: req.id },
      );
    }
    const parsed = followUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const event = await loadEventScoped(user, req.params.eventId);
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
    let statusUpdate: SafetyEventStatusT | undefined;
    if (
      event.status === SafetyEventStatus.ConfirmedAE ||
      event.status === SafetyEventStatus.ConfirmedSAE ||
      event.status === SafetyEventStatus.Reported
    ) {
      assertSafetyTransition(event.status, SafetyEventStatus.FollowUp);
      await prisma().safetyEvent.update({
        where: { id: event.id },
        data: { status: SafetyEventStatus.FollowUp },
      });
      statusUpdate = SafetyEventStatus.FollowUp;
    }
    await audit(req, user, "safety-event.follow-up", "SafetyEvent", event.id, {
      followUpId: fu.id,
      statusChange: statusUpdate ? { from: event.status, to: statusUpdate } : null,
    });
    return {
      id: fu.id,
      followUpAt: fu.followUpAt.toISOString(),
      outcome: fu.outcome,
      status: statusUpdate ?? event.status,
    };
  });

  /* ─── Close (PI / Sponsor / SystemAdmin; reason required) ── */
  app.post<{
    Params: { eventId: string };
    Body: z.infer<typeof closeSchema>;
  }>("/api/safety/events/:eventId/close", async (req) => {
    const user = await requireUser(req);
    assertRole(user, ROLES_THAT_CAN_REPORT_OR_CLOSE, "close safety events", req.id);
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const event = await loadEventScoped(user, req.params.eventId);
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
    await writeAuditWithReason({
      projectId: event.projectId,
      actorUserId: user.userId,
      actorRole: user.role,
      action: "close",
      objectId: event.id,
      beforeValue: { status: event.status },
      afterValue: { status: updated.status },
      reason: parsed.data.reason,
      requestId: req.id,
    });
    return { id: updated.id, status: updated.status };
  });
}
