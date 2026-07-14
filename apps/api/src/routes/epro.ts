/**
 * ePRO / eCOA endpoints for Phase 2.
 *
 *   GET  /api/epro/templates?projectId=    — list QuestionnaireTemplate
 *   GET  /api/epro/responses?subjectId=     — list responses for a subject
 *   GET  /api/epro/responses/:responseId   — response + schema
 *   POST /api/epro/responses                — start a response (Scheduled status)
 *   PATCH /api/epro/responses/:id           — save partial answers
 *   POST /api/epro/responses/:id/submit     — submit (Scheduled → InProgress → Submitted)
 *   POST /api/epro/responses/:id/review     — PI/CRC mark Reviewed
 *
 * The schema is intentionally generic: `QuestionnaireTemplate.schema` is
 * a JSON document describing the form (sections + items). The Phase 2
 * client renders this. Custom question types land in Phase 3+ — the
 * supported types here are: scale, single, multi, text, number.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  DataEntryChannel,
  Permission,
  QuestionnaireStatus,
  Role,
  authorize,
  type QuestionnaireStatus as QuestionnaireStatusT,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  assertProjectAccess,
  assertQuestionnaireTransition,
  assertCrcUsesAssistedEntry,
  assertSubjectSelfScope,
  audit,
  requireUser,
  resolveActorRoleForProject,
  resolveProjectScope,
  resolveSubjectIdentity,
  type AuthenticatedUser,
} from "../lib/auth.js";

const listTemplatesSchema = z.object({
  projectId: z.string().optional(),
});

const listResponsesSchema = z.object({
  subjectId: z.string().optional(),
  status: z.string().optional(),
  projectId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const startResponseSchema = z.object({
  subjectId: z.string().min(1),
  questionnaireTemplateId: z.string().min(1),
  visitId: z.string().optional(),
});

const saveResponseSchema = z.object({
  responses: z.record(z.unknown()),
});

const submitResponseSchema = z.object({
  responses: z.record(z.unknown()),
});

const reviewSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const ROLES_THAT_CAN_REVIEW: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.CROPM,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

interface QuestionnaireItem {
  id: string;
  type: "scale" | "single" | "multi" | "text" | "number";
  prompt: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
}

interface QuestionnaireSection {
  id: string;
  title: string;
  items: QuestionnaireItem[];
}

interface QuestionnaireSchema {
  sections: QuestionnaireSection[];
}

export function registerEproRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: z.infer<typeof listTemplatesSchema> }>(
    "/api/epro/templates",
    async (req) => {
      const user = await requireUser(req);
      const parsed = listTemplatesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const projectId = resolveProjectScope(user, parsed.data.projectId, req.id);
      const rows = await prisma().questionnaireTemplate.findMany({
        where: { projectId },
        orderBy: [{ name: "asc" }, { version: "asc" }],
      });
      return {
        items: rows.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          version: t.version,
          itemCount: countItems(t.schema as unknown as QuestionnaireSchema),
        })),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listResponsesSchema> }>(
    "/api/epro/responses",
    async (req) => {
      const user = await requireUser(req);
      const parsed = listResponsesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { subjectId, status, projectId, page, pageSize } = parsed.data;
      const scopeProjectId = resolveProjectScope(user, projectId, req.id);
      let boundSubjectId: string | undefined;
      if (user.role === Role.Subject) {
        const identity = await resolveSubjectIdentity(user, req.id);
        boundSubjectId = identity.subjectId;
        if (subjectId && subjectId !== identity.subjectId) {
          throw new ApiErrorException(
            ApiErrorCode.FORBIDDEN,
            "Subject identity may only list own records",
            { requestId: req.id },
          );
        }
      }
      const where: Record<string, unknown> = {
        subject: { projectId: scopeProjectId },
        ...(boundSubjectId ? { subjectId: boundSubjectId } : subjectId ? { subjectId } : {}),
        ...(status ? { status: status as QuestionnaireStatusT } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().questionnaireResponse.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().questionnaireResponse.count({ where }),
      ]);
      // Resolve subject/template/actor names in batched follow-up
      // queries — the QuestionnaireResponse schema does not expose
      // back-relations, so we look up by id and zip in app-side.
      const subjectIds = Array.from(new Set(rows.map((r) => r.subjectId)));
      const templateIds = Array.from(
        new Set(rows.map((r) => r.questionnaireTemplateId)),
      );
      const submittedByIds = Array.from(
        new Set(
          rows
            .map((r) => r.submittedByUserId)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const reviewedByIds = Array.from(
        new Set(
          rows
            .map((r) => r.reviewedByUserId)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const [subjects, templates, submitters, reviewers] = await Promise.all([
        subjectIds.length === 0
          ? []
          : prisma().subject.findMany({
              where: { id: { in: subjectIds } },
              select: { id: true, subjectCode: true },
            }),
        templateIds.length === 0
          ? []
          : prisma().questionnaireTemplate.findMany({
              where: { id: { in: templateIds } },
              select: { id: true, name: true, version: true, code: true },
            }),
        submittedByIds.length === 0
          ? []
          : prisma().user.findMany({
              where: { id: { in: submittedByIds } },
              select: { id: true, displayName: true },
            }),
        reviewedByIds.length === 0
          ? []
          : prisma().user.findMany({
              where: { id: { in: reviewedByIds } },
              select: { id: true, displayName: true },
            }),
      ]);
      const subjectMap = new Map<string, string>(
        subjects.map((s: { id: string; subjectCode: string }) => [s.id, s.subjectCode]),
      );
      const templateMap = new Map<
        string,
        { name: string; version: string; code: string }
      >(templates.map((t: { id: string; name: string; version: string; code: string }) => [t.id, t]));
      const submitterMap = new Map<string, string>(
        submitters.map((u: { id: string; displayName: string }) => [u.id, u.displayName]),
      );
      const reviewerMap = new Map<string, string>(
        reviewers.map((u: { id: string; displayName: string }) => [u.id, u.displayName]),
      );
      return {
        total,
        page,
        pageSize,
        items: rows.map((r) => ({
          id: r.id,
          subjectId: r.subjectId,
          subjectCode: subjectMap.get(r.subjectId) ?? "—",
          templateName: templateMap.get(r.questionnaireTemplateId)?.name ?? "—",
          templateVersion: templateMap.get(r.questionnaireTemplateId)?.version ?? "—",
          templateCode: templateMap.get(r.questionnaireTemplateId)?.code ?? "—",
          status: r.status,
          submittedBy: r.submittedByUserId
            ? (submitterMap.get(r.submittedByUserId) ?? null)
            : null,
          submittedAt: r.submittedAt?.toISOString() ?? null,
          reviewedBy: r.reviewedByUserId
            ? (reviewerMap.get(r.reviewedByUserId) ?? null)
            : null,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          entryChannel: r.entryChannel,
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  app.get<{ Params: { responseId: string } }>(
    "/api/epro/responses/:responseId",
    async (req) => {
      const user = await requireUser(req);
      const resp = await loadResponseScoped(user, req.params.responseId, req.id);
      await assertSubjectSelfScope(user, resp.subjectId, req.id);
      const [subject, template, submitter, reviewer, assistedEntry] = await Promise.all([
        prisma().subject.findUnique({
          where: { id: resp.subjectId },
          select: { id: true, subjectCode: true },
        }),
        prisma().questionnaireTemplate.findUnique({
          where: { id: resp.questionnaireTemplateId },
        }),
        resp.submittedByUserId
          ? prisma().user.findUnique({
              where: { id: resp.submittedByUserId },
              select: { displayName: true },
            })
          : null,
        resp.reviewedByUserId
          ? prisma().user.findUnique({
              where: { id: resp.reviewedByUserId },
              select: { displayName: true },
            })
          : null,
        resp.entryChannel === DataEntryChannel.AssistedEntry
          ? prisma().assistedEntry.findUnique({
              where: { questionnaireResponseId: resp.id },
              include: {
                recorder: { select: { id: true, displayName: true } },
                corrections: {
                  orderBy: { correctedAt: "asc" },
                  include: { actor: { select: { displayName: true } } },
                },
              },
            })
          : null,
      ]);
      return {
        response: {
          id: resp.id,
          subjectId: resp.subjectId,
          status: resp.status,
          entryChannel: resp.entryChannel,
          responses: resp.responses as Record<string, unknown>,
          submittedAt: resp.submittedAt?.toISOString() ?? null,
          reviewedAt: resp.reviewedAt?.toISOString() ?? null,
          submittedBy: submitter?.displayName ?? null,
          reviewedBy: reviewer?.displayName ?? null,
          updatedAt: resp.updatedAt.toISOString(),
        },
        template: template
          ? {
              id: template.id,
              code: template.code,
              name: template.name,
              version: template.version,
              schema: template.schema,
            }
          : null,
        subject: subject
          ? { id: subject.id, subjectCode: subject.subjectCode }
          : { id: resp.subjectId, subjectCode: "—" },
        assistedEntry: assistedEntry
          ? {
              id: assistedEntry.id,
              reason: assistedEntry.reason,
              collectionChannel: assistedEntry.collectionChannel,
              recordedAt: assistedEntry.recordedAt.toISOString(),
              recorder: assistedEntry.recorder,
              dataOrigin: "AssistedEntry",
              corrections: assistedEntry.corrections.map((c) => ({
                id: c.id,
                reason: c.reason,
                actorName: c.actor.displayName,
                correctedAt: c.correctedAt.toISOString(),
              })),
            }
          : null,
      };
    },
  );

  app.post<{ Body: z.infer<typeof startResponseSchema> }>(
    "/api/epro/responses",
    async (req) => {
      const user = await requireUser(req);
      assertCrcUsesAssistedEntry(user.role, req.id);
      const parsed = startResponseSchema.safeParse(req.body);
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
      await assertSubjectSelfScope(user, subject.id, req.id);
      const tpl = await prisma().questionnaireTemplate.findUnique({
        where: { id: parsed.data.questionnaireTemplateId },
      });
      if (!tpl) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Template not found",
          { requestId: req.id },
        );
      }
      // R2: template must belong to a project the caller can reach.
      assertProjectAccess(user, tpl.projectId, req.id);
      // Subject + template must live in the same project; otherwise
      // refuse to forge a cross-project response.
      if (subject.projectId !== tpl.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Subject and template must belong to the same project",
          { requestId: req.id, details: { subjectProject: subject.projectId, templateProject: tpl.projectId } },
        );
      }
      // R1: write permission evaluated against the actor's role on the
      // target project.
      const startActor = resolveActorRoleForProject(user, subject.projectId, req.id);
      authorize(
        { userId: startActor.userId, role: startActor.role },
        Permission.QuestionnaireSubmit,
        { requestId: req.id },
      );
      const resp = await prisma().questionnaireResponse.create({
        data: {
          subjectId: parsed.data.subjectId,
          visitId: parsed.data.visitId ?? null,
          questionnaireTemplateId: parsed.data.questionnaireTemplateId,
          status: QuestionnaireStatus.Scheduled,
          entryChannel:
            user.role === Role.Subject
              ? DataEntryChannel.SubjectSelfReport
              : DataEntryChannel.StaffEntry,
          responses: {},
        },
      });
      await audit(req, user, "epro.response.create", "QuestionnaireResponse", resp.id, {
        subjectId: subject.id,
        templateId: tpl.id,
      });
      return { id: resp.id, status: resp.status };
    },
  );

  app.patch<{
    Params: { responseId: string };
    Body: z.infer<typeof saveResponseSchema>;
  }>("/api/epro/responses/:responseId", async (req) => {
    const user = await requireUser(req);
    assertCrcUsesAssistedEntry(user.role, req.id);
    const parsed = saveResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const resp = await loadResponseScoped(user, req.params.responseId, req.id);
    await assertSubjectSelfScope(user, resp.subjectId, req.id);
    if (
      resp.entryChannel === DataEntryChannel.SubjectSelfReport &&
      user.role !== Role.Subject
    ) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        "Staff cannot modify a Subject-original ePRO response",
        { requestId: req.id, details: { responseId: resp.id, entryChannel: resp.entryChannel } },
      );
    }
    if (
      resp.status !== QuestionnaireStatus.Scheduled &&
      resp.status !== QuestionnaireStatus.InProgress &&
      resp.status !== QuestionnaireStatus.Late
    ) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        `Cannot save answers in status ${resp.status}`,
        { details: { responseId: resp.id, status: resp.status } },
      );
    }
    // Auto-promote Scheduled → InProgress on the first save so the
    // dashboard and audit log can see the subject is actively filling.
    const promote =
      resp.status === QuestionnaireStatus.Scheduled
        ? QuestionnaireStatus.InProgress
        : resp.status;
    if (promote !== resp.status) {
      assertQuestionnaireTransition(resp.status, promote);
    }
    const updated = await prisma().questionnaireResponse.update({
      where: { id: resp.id },
      data: {
        responses: parsed.data.responses as object,
        status: promote,
      },
    });
    await audit(req, user, "epro.response.save", "QuestionnaireResponse", resp.id, {
      status: updated.status,
      answerCount: Object.keys(parsed.data.responses).length,
    });
    return { id: updated.id, status: updated.status };
  });

  app.post<{
    Params: { responseId: string };
    Body: z.infer<typeof submitResponseSchema>;
  }>("/api/epro/responses/:responseId/submit", async (req) => {
    const user = await requireUser(req);
    assertCrcUsesAssistedEntry(user.role, req.id);
    const parsed = submitResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const resp = await loadResponseScoped(user, req.params.responseId, req.id);
    await assertSubjectSelfScope(user, resp.subjectId, req.id);
    if (
      resp.entryChannel === DataEntryChannel.SubjectSelfReport &&
      user.role !== Role.Subject
    ) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        "Staff cannot submit on behalf of a Subject-original ePRO response",
        { requestId: req.id, details: { responseId: resp.id, entryChannel: resp.entryChannel } },
      );
    }
    // Walk Scheduled → InProgress → Submitted in one transaction.
    assertQuestionnaireTransition(resp.status, QuestionnaireStatus.InProgress);
    assertQuestionnaireTransition(QuestionnaireStatus.InProgress, QuestionnaireStatus.Submitted);
    const entryChannel =
      user.role === Role.Subject
        ? DataEntryChannel.SubjectSelfReport
        : resp.entryChannel;
    const updated = await prisma().questionnaireResponse.update({
      where: { id: resp.id },
      data: {
        responses: parsed.data.responses as object,
        status: QuestionnaireStatus.Submitted,
        entryChannel,
        submittedAt: new Date(),
        submittedByUserId: user.userId,
      },
    });
    await audit(req, user, "epro.response.submit", "QuestionnaireResponse", resp.id, {
      answerCount: Object.keys(parsed.data.responses).length,
      entryChannel,
    });
    return { id: updated.id, status: updated.status };
  });

  app.post<{
    Params: { responseId: string };
    Body: z.infer<typeof reviewSchema>;
  }>("/api/epro/responses/:responseId/review", async (req) => {
    const user = await requireUser(req);
    if (!ROLES_THAT_CAN_REVIEW.has(user.role)) {
      throw new ApiErrorException(
        ApiErrorCode.FORBIDDEN,
        `Role ${user.role} cannot review responses`,
        { requestId: req.id },
      );
    }
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const resp = await loadResponseScoped(user, req.params.responseId, req.id);
    assertQuestionnaireTransition(resp.status, QuestionnaireStatus.Reviewed);
    const updated = await prisma().questionnaireResponse.update({
      where: { id: resp.id },
      data: {
        status: QuestionnaireStatus.Reviewed,
        reviewedAt: new Date(),
        reviewedByUserId: user.userId,
      },
    });
    await audit(req, user, "epro.response.review", "QuestionnaireResponse", resp.id, {
      notes: parsed.data.notes ?? null,
    });
    return { id: updated.id, status: updated.status };
  });
}

async function loadResponseScoped(
  user: AuthenticatedUser,
  responseId: string,
  requestId: string,
) {
  const resp = await prisma().questionnaireResponse.findUnique({
    where: { id: responseId },
  });
  if (!resp) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Response not found",
      { requestId, details: { responseId } },
    );
  }
  const subject = await prisma().subject.findUnique({
    where: { id: resp.subjectId },
  });
  if (!subject) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Subject not found",
      { requestId, details: { responseId } },
    );
  }
  // R2: enforce via caller's full role assignment list.
  assertProjectAccess(user, subject.projectId, requestId);
  return resp;
}

function countItems(schema: unknown): number {
  if (
    !schema ||
    typeof schema !== "object" ||
    !("sections" in schema) ||
    !Array.isArray((schema as QuestionnaireSchema).sections)
  ) {
    return 0;
  }
  return (schema as QuestionnaireSchema).sections.reduce(
    (acc, s) => acc + (Array.isArray(s.items) ? s.items.length : 0),
    0,
  );
}
