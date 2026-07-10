/**
 * Subject endpoints for Phase 2. The skeleton in Phase 0 is replaced:
 *   GET    /api/subjects                       — list subjects in the caller's project
 *   POST   /api/subjects                       — create a new subject (PreScreening default)
 *   GET    /api/subjects/:subjectId            — subject detail + related visits/risks
 *   GET    /api/subjects/:subjectId/identity/full
 *                                             — PII; 403 for roles outside the
 *                                                PII_ALLOWED set (server-enforced)
 *   PATCH  /api/subjects/:subjectId/status    — transition status with RBAC + lifecycle guard
 *   POST   /api/subjects/:subjectId/withdraw   — withdraw with required reason
 *
 * The Web SubjectsPage + SubjectDetailPage consume these. Identity masking
 * happens server-side so the client cannot accidentally render PII.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  Role,
  SubjectStatus,
  type SubjectStatus as SubjectStatusT,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  audit,
  assertSubjectTransition,
  canUnmaskPII,
  maskEmail,
  maskName,
  maskNationalId,
  maskPhone,
  requireUser,
  type AuthenticatedUser,
} from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.string().optional(),
  siteId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSubjectSchema = z.object({
  subjectCode: z.string().min(1).max(64),
  siteId: z.string().min(1),
  status: z.nativeEnum(SubjectStatus).optional(),
  initials: z.string().max(8).optional(),
  enrollmentDate: z.string().datetime().optional(),
});

const statusPatchSchema = z.object({
  to: z.nativeEnum(SubjectStatus),
  reason: z.string().max(500).optional(),
});

const withdrawSchema = z.object({
  reason: z.string().min(1).max(500),
  effectiveAt: z.string().datetime().optional(),
});

const ROLES_THAT_CAN_CREATE: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.SponsorAdmin,
  Role.CROPM,
  Role.SystemAdmin,
]);

const ROLES_THAT_CAN_TRANSITION: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.CROPM,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

export function registerSubjectRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/subjects",
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
      const { projectId, status, siteId, search, page, pageSize } = parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
        ...(status ? { status: status as SubjectStatusT } : {}),
        ...(siteId ? { siteId } : {}),
        ...(search
          ? {
              OR: [
                { subjectCode: { contains: search, mode: "insensitive" as const } },
                { initials: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().subject.findMany({
          where,
          include: { site: true, owner: true },
          orderBy: { enrollmentDate: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().subject.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((s) => ({
          id: s.id,
          subjectCode: s.subjectCode,
          initials: s.initials ?? null,
          siteCode: s.site.code,
          siteName: s.site.name,
          status: s.status,
          enrollmentDate: s.enrollmentDate?.toISOString() ?? null,
          owner: s.owner?.displayName ?? null,
          ageBand: s.ageBand,
          yearOfBirth: s.yearOfBirth,
          sex: s.sex,
        })),
      };
    },
  );

  /* ─── Create ──────────────────────────────────────────── */
  app.post<{ Body: z.infer<typeof createSubjectSchema> }>(
    "/api/subjects",
    async (req) => {
      const user = await requireUser(req);
      if (!ROLES_THAT_CAN_CREATE.has(user.role)) {
        throw new ApiErrorException(
          ApiErrorCode.FORBIDDEN,
          `Role ${user.role} cannot create subjects`,
          { requestId: req.id },
        );
      }
      const parsed = createSubjectSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const site = await prisma().site.findUnique({ where: { id: parsed.data.siteId } });
      if (!site || site.projectId !== user.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Site not found in current project",
          { requestId: req.id },
        );
      }
      const created = await prisma().subject.create({
        data: {
          projectId: user.projectId,
          siteId: parsed.data.siteId,
          subjectCode: parsed.data.subjectCode,
          initials: parsed.data.initials ?? null,
          status: parsed.data.status ?? SubjectStatus.PreScreening,
          enrollmentDate: parsed.data.enrollmentDate
            ? new Date(parsed.data.enrollmentDate)
            : null,
        },
      });
      await audit(req, user, "subject.create", "Subject", created.id, {
        subjectCode: created.subjectCode,
        siteId: created.siteId,
        status: created.status,
      });
      return { id: created.id, subjectCode: created.subjectCode };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { subjectId: string } }>(
    "/api/subjects/:subjectId",
    async (req) => {
      const user = await requireUser(req);
      const subject = await loadSubjectScoped(user, req.params.subjectId);
      const [visits, risks, consents, aeCount, taskCount] = await Promise.all([
        prisma().visit.findMany({
          where: { subjectId: subject.id },
          orderBy: { scheduledAt: "desc" },
          take: 20,
          include: { remoteSession: true },
        }),
        prisma().riskSignal.findMany({
          where: { subjectId: subject.id, status: { not: "Closed" } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma().consentTask.findMany({
          where: { subjectId: subject.id },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { document: true },
        }),
        prisma().safetyEvent.count({ where: { subjectId: subject.id } }),
        prisma().riskSignal.count({
          where: { subjectId: subject.id, status: { not: "Closed" } },
        }),
      ]);
      return {
        subject: {
          id: subject.id,
          subjectCode: subject.subjectCode,
          initials: subject.initials ?? null,
          siteCode: subject.site.code,
          siteName: subject.site.name,
          status: subject.status,
          enrollmentDate: subject.enrollmentDate?.toISOString() ?? null,
          ageBand: subject.ageBand,
          yearOfBirth: subject.yearOfBirth,
          sex: subject.sex,
          owner: subject.owner?.displayName ?? null,
        },
        counts: { visits: visits.length, openRisks: taskCount, aes: aeCount },
        visits: visits.map((v) => ({
          id: v.id,
          visitCode: v.visitCode,
          status: v.status,
          scheduledAt: v.scheduledAt.toISOString(),
          windowStart: v.windowStart.toISOString(),
          windowEnd: v.windowEnd.toISOString(),
          isRemote: Boolean(v.remoteSession),
        })),
        risks: risks.map((r) => ({
          id: r.id,
          type: r.type,
          level: r.level,
          status: r.status,
          trigger: r.trigger,
          suggestion: r.suggestion,
          createdAt: r.createdAt.toISOString(),
        })),
        consents: consents.map((c) => ({
          id: c.id,
          documentTitle: c.document.title,
          status: c.status,
          version: c.document.version,
          updatedAt: c.updatedAt.toISOString(),
        })),
        unmaskAllowed: canUnmaskPII(user.role),
      };
    },
  );

  /* ─── Identity (PII; role-gated) ──────────────────────── */
  app.get<{ Params: { subjectId: string } }>(
    "/api/subjects/:subjectId/identity/full",
    async (req) => {
      const user = await requireUser(req);
      if (!canUnmaskPII(user.role)) {
        throw new ApiErrorException(
          ApiErrorCode.FORBIDDEN,
          `Role ${user.role} is not allowed to view subject PII`,
          { requestId: req.id },
        );
      }
      const subject = await loadSubjectScoped(user, req.params.subjectId);
      const identity = await prisma().subjectSensitiveIdentity.findUnique({
        where: { subjectId: subject.id },
      });
      await audit(req, user, "subject.identity.view", "Subject", subject.id, {
        scope: "full",
      });
      return {
        subjectId: subject.id,
        subjectCode: subject.subjectCode,
        fullName: identity?.fullName ?? null,
        nationalId: identity?.nationalId ?? null,
        phone: identity?.phone ?? null,
        email: identity?.email ?? null,
        address: identity?.address ?? null,
      };
    },
  );

  /* ─── Status transition ──────────────────────────────── */
  app.patch<{
    Params: { subjectId: string };
    Body: z.infer<typeof statusPatchSchema>;
  }>("/api/subjects/:subjectId/status", async (req) => {
    const user = await requireUser(req);
    if (!ROLES_THAT_CAN_TRANSITION.has(user.role)) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        `Role ${user.role} cannot transition subject status`,
        { requestId: req.id },
      );
    }
    const parsed = statusPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const subject = await loadSubjectScoped(user, req.params.subjectId);
    assertSubjectTransition(subject.status, parsed.data.to);
    const updated = await prisma().subject.update({
      where: { id: subject.id },
      data: { status: parsed.data.to },
    });
    await audit(req, user, "subject.status.transition", "Subject", subject.id, {
      from: subject.status,
      to: updated.status,
      reason: parsed.data.reason ?? null,
    });
    return { id: updated.id, status: updated.status };
  });

  /* ─── Withdraw ───────────────────────────────────────── */
  app.post<{
    Params: { subjectId: string };
    Body: z.infer<typeof withdrawSchema>;
  }>("/api/subjects/:subjectId/withdraw", async (req) => {
    const user = await requireUser(req);
    if (!ROLES_THAT_CAN_TRANSITION.has(user.role)) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        `Role ${user.role} cannot withdraw a subject`,
        { requestId: req.id },
      );
    }
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const subject = await loadSubjectScoped(user, req.params.subjectId);
    assertSubjectTransition(subject.status, SubjectStatus.Withdrawn);
    const updated = await prisma().subject.update({
      where: { id: subject.id },
      data: {
        status: SubjectStatus.Withdrawn,
        withdrawnDate: parsed.data.effectiveAt
          ? new Date(parsed.data.effectiveAt)
          : new Date(),
      },
    });
    await audit(req, user, "subject.withdraw", "Subject", subject.id, {
      reason: parsed.data.reason,
      effectiveAt: updated.withdrawnDate?.toISOString() ?? null,
    });
    return {
      id: updated.id,
      status: updated.status,
      withdrawnDate: updated.withdrawnDate?.toISOString() ?? null,
    };
  });
}

async function loadSubjectScoped(
  user: AuthenticatedUser,
  subjectId: string,
) {
  const subject = await prisma().subject.findUnique({
    where: { id: subjectId },
    include: { site: true, owner: true },
  });
  if (!subject) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Subject not found",
      { requestId: "scoped", details: { subjectId } },
    );
  }
  if (subject.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Subject belongs to a different project",
      { details: { subjectId } },
    );
  }
  return subject;
}

/** Public re-export so other modules (dashboard) can share the same
 *  masking strategy without re-implementing it. */
export { maskName, maskNationalId, maskPhone, maskEmail };
