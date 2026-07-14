/**
 * Consent workflow endpoints for Phase 2.
 *
 *   GET  /api/consent                                — list consent tasks in project
 *   GET  /api/consent/:taskId                        — task detail + signature trail
 *   POST /api/consent                                — create a new consent task for a subject
 *   POST /api/consent/:taskId/start                  — NotStarted → Reading
 *   POST /api/consent/:taskId/comprehension          — submit comprehension score, → ComprehensionPending
 *   POST /api/consent/:taskId/sign                   — append a SignatureRecord (subject or investigator)
 *   POST /api/consent/:taskId/withdraw               — withdraw (any non-terminal state → Withdrawn)
 *
 * Server enforces the lifecycle (domain ConsentStatus transitions),
 * RBAC (PI/CRC sign investigator side, Subject signs subject side),
 * and writes AuditEvents for every transition.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  ConsentStatus,
  Permission,
  Role,
  authorize,
  type ConsentStatus as ConsentStatusT,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  assertConsentTransition,
  assertProjectAccess,
  audit,
  requireUser,
  resolveActorRoleForProject,
  resolveProjectScope,
  type AuthenticatedUser,
} from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.string().optional(),
  subjectId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  subjectId: z.string().min(1),
  consentDocumentId: z.string().min(1),
});

const comprehensionSchema = z.object({
  score: z.number().min(0).max(100),
  totalQuestions: z.number().int().min(1).max(50),
});

const signSchema = z.object({
  signerRole: z.enum(["Subject", "Investigator", "Witness"]),
  signatureMethod: z.enum(["ESign", "WetInk", "Biometric"]),
  signaturePayload: z.string().min(1).max(8192),
});

const withdrawSchema = z.object({
  reason: z.string().min(1).max(500),
});

const ROLES_THAT_CAN_INVESTIGATOR_SIGN: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

export function registerConsentRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/consent",
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
      const { projectId, status, subjectId, page, pageSize } = parsed.data;
      const scopeProjectId = resolveProjectScope(user, projectId, req.id);
      const where: Record<string, unknown> = {
        subject: { projectId: scopeProjectId },
        ...(status ? { status: status as ConsentStatusT } : {}),
        ...(subjectId ? { subjectId } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().consentTask.findMany({
          where,
          include: {
            subject: { select: { subjectCode: true, id: true } },
            document: true,
            signatures: { orderBy: { signedAt: "asc" } },
          },
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().consentTask.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((t) => ({
          id: t.id,
          subjectId: t.subject.id,
          subjectCode: t.subject.subjectCode,
          documentTitle: t.document.title,
          documentVersion: t.document.version,
          documentUrl: t.document.documentUrl,
          status: t.status,
          comprehensionScore: t.comprehensionScore,
          startedAt: t.startedAt?.toISOString() ?? null,
          completedAt: t.completedAt?.toISOString() ?? null,
          updatedAt: t.updatedAt.toISOString(),
          signatureCount: t.signatures.length,
        })),
      };
    },
  );

  app.get<{ Params: { taskId: string } }>(
    "/api/consent/:taskId",
    async (req) => {
      const user = await requireUser(req);
      const task = await loadTaskScoped(user, req.params.taskId, req.id);
      return {
        task: {
          id: task.id,
          subjectId: task.subjectId,
          subjectCode: task.subject.subjectCode,
          status: task.status,
          comprehensionScore: task.comprehensionScore,
          startedAt: task.startedAt?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          updatedAt: task.updatedAt.toISOString(),
        },
        document: {
          id: task.document.id,
          title: task.document.title,
          version: task.document.version,
          documentUrl: task.document.documentUrl,
          effectiveFrom: task.document.effectiveFrom.toISOString(),
        },
        signatures: task.signatures.map((s) => ({
          id: s.id,
          signerRole: s.signerRole,
          signerUserId: s.signerUserId,
          signedAt: s.signedAt.toISOString(),
          method: s.signatureMethod,
          ipAddress: s.ipAddress,
        })),
      };
    },
  );

  app.post<{ Body: z.infer<typeof createSchema> }>(
    "/api/consent",
    async (req) => {
      const user = await requireUser(req);
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
          { requestId: req.id },
        );
      }
      // R2: enforce via caller's role assignment list.
      assertProjectAccess(user, subject.projectId, req.id);
      const doc = await prisma().consentDocument.findUnique({
        where: { id: parsed.data.consentDocumentId },
      });
      if (!doc) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Consent document not found",
          { requestId: req.id },
        );
      }
      // R2: document must belong to a project the caller can reach.
      assertProjectAccess(user, doc.projectId, req.id);
      // Subject + document must live in the same project; otherwise
      // refuse to forge a cross-project consent task.
      if (subject.projectId !== doc.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Subject and consent document must belong to the same project",
          { requestId: req.id, details: { subjectProject: subject.projectId, documentProject: doc.projectId } },
        );
      }
      // R1: permission evaluated against the actor's role on the target
      // project (the subject's project).
      const createActor = resolveActorRoleForProject(user, subject.projectId, req.id);
      authorize(
        { userId: createActor.userId, role: createActor.role },
        Permission.ConsentRead,
        { requestId: req.id },
      );
      const task = await prisma().consentTask.create({
        data: {
          subjectId: parsed.data.subjectId,
          consentDocumentId: parsed.data.consentDocumentId,
          status: ConsentStatus.NotStarted,
        },
      });
      await audit(req, user, "consent.create", "ConsentTask", task.id, {
        subjectId: subject.id,
        documentId: doc.id,
        documentVersion: doc.version,
      });
      return { id: task.id, status: task.status };
    },
  );

  app.post<{ Params: { taskId: string } }>(
    "/api/consent/:taskId/start",
    async (req) => {
      const user = await requireUser(req);
      const task = await loadTaskScoped(user, req.params.taskId, req.id);
      assertConsentTransition(task.status, ConsentStatus.Reading);
      const updated = await prisma().consentTask.update({
        where: { id: task.id },
        data: { status: ConsentStatus.Reading, startedAt: new Date() },
      });
      await audit(req, user, "consent.start", "ConsentTask", task.id, {
        from: task.status,
        to: updated.status,
      });
      return { id: updated.id, status: updated.status };
    },
  );

  app.post<{
    Params: { taskId: string };
    Body: z.infer<typeof comprehensionSchema>;
  }>("/api/consent/:taskId/comprehension", async (req) => {
    const user = await requireUser(req);
    const parsed = comprehensionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const task = await loadTaskScoped(user, req.params.taskId, req.id);
    assertConsentTransition(task.status, ConsentStatus.ComprehensionPending);
    const percent = parsed.data.score / parsed.data.totalQuestions;
    if (percent < 0.6) {
      // Comprehension failed — go back to Reading for re-study.
      const updated = await prisma().consentTask.update({
        where: { id: task.id },
        data: { status: ConsentStatus.Reading, comprehensionScore: percent },
      });
      await audit(req, user, "consent.comprehension.fail", "ConsentTask", task.id, {
        score: parsed.data.score,
        total: parsed.data.totalQuestions,
        percent,
      });
      return { id: updated.id, status: updated.status, passed: false, percent };
    }
    const updated = await prisma().consentTask.update({
      where: { id: task.id },
      data: {
        status: ConsentStatus.ComprehensionPending,
        comprehensionScore: percent,
      },
    });
    await audit(req, user, "consent.comprehension.pass", "ConsentTask", task.id, {
      score: parsed.data.score,
      total: parsed.data.totalQuestions,
      percent,
    });
    return { id: updated.id, status: updated.status, passed: true, percent };
  });

  app.post<{
    Params: { taskId: string };
    Body: z.infer<typeof signSchema>;
  }>("/api/consent/:taskId/sign", async (req) => {
    const user = await requireUser(req);
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    if (
      parsed.data.signerRole === "Investigator" &&
      !ROLES_THAT_CAN_INVESTIGATOR_SIGN.has(user.role)
    ) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        `Role ${user.role} cannot sign as Investigator`,
        { requestId: req.id },
      );
    }
    const task = await loadTaskScoped(user, req.params.taskId, req.id);
    // Decide the next lifecycle status based on the role signature we
    // are about to add. Order: Subject → Investigator → Completed.
    const existingRoles = new Set(task.signatures.map((s) => s.signerRole));
    const target: ConsentStatusT =
      parsed.data.signerRole === "Subject"
        ? ConsentStatus.SubjectSigned
        : parsed.data.signerRole === "Investigator"
          ? ConsentStatus.InvestigatorSigned
          : task.status; // Witness: no lifecycle change
    assertConsentTransition(task.status, target);
    const updated = await prisma().consentTask.update({
      where: { id: task.id },
      data: {
        status: target,
        completedAt:
          target === ConsentStatus.InvestigatorSigned &&
          !existingRoles.has("Subject")
            ? null
            : target === ConsentStatus.InvestigatorSigned
              ? new Date()
              : task.completedAt,
        signatures: {
          create: {
            signerUserId: user.userId,
            signerRole: parsed.data.signerRole,
            signedAt: new Date(),
            signatureMethod: parsed.data.signatureMethod,
            signaturePayload: parsed.data.signaturePayload,
            ipAddress: req.ip,
          },
        },
      },
    });
    await audit(req, user, "consent.sign", "ConsentTask", task.id, {
      signerRole: parsed.data.signerRole,
      method: parsed.data.signatureMethod,
      from: task.status,
      to: target,
    });
    return { id: updated.id, status: updated.status };
  });

  app.post<{
    Params: { taskId: string };
    Body: z.infer<typeof withdrawSchema>;
  }>("/api/consent/:taskId/withdraw", async (req) => {
    const user = await requireUser(req);
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const task = await loadTaskScoped(user, req.params.taskId, req.id);
    assertConsentTransition(task.status, ConsentStatus.Withdrawn);
    const updated = await prisma().consentTask.update({
      where: { id: task.id },
      data: { status: ConsentStatus.Withdrawn },
    });
    await audit(req, user, "consent.withdraw", "ConsentTask", task.id, {
      reason: parsed.data.reason,
    });
    return { id: updated.id, status: updated.status };
  });
}

async function loadTaskScoped(
  user: AuthenticatedUser,
  taskId: string,
  requestId: string,
) {
  const task = await prisma().consentTask.findUnique({
    where: { id: taskId },
    include: {
      subject: true,
      document: true,
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!task) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Consent task not found",
      { requestId, details: { taskId } },
    );
  }
  // R2: enforce via caller's full role assignment list.
  assertProjectAccess(user, task.subject.projectId, requestId);
  return task;
}
