/**
 * CRC Assisted Entry — minimum slice (ePRO only).
 *
 * Staff records information provided by a Subject as a distinct AssistedEntry
 * record. entryChannel is ALWAYS AssistedEntry — never SubjectSelfReport.
 *
 *   POST  /api/epro/assisted-entries/start
 *   PATCH /api/epro/assisted-entries/:assistedEntryId/save
 *   POST  /api/epro/assisted-entries/:assistedEntryId/submit
 *   POST  /api/epro/assisted-entries/:assistedEntryId/corrections
 *   GET   /api/epro/assisted-entries/:assistedEntryId
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AssistedCollectionChannel,
  DataEntryChannel,
  Permission,
  QuestionnaireStatus,
  AuditAction,
  authorize,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  assertProjectAccess,
  assertQuestionnaireTransition,
  audit,
  auditTx,
  requireUser,
  resolveActorRoleForProject,
  type AuthenticatedUser,
} from "../lib/auth.js";

const startSchema = z.object({
  subjectId: z.string().min(1),
  questionnaireTemplateId: z.string().min(1),
  visitId: z.string().optional(),
  reason: z.string().min(1).max(2000),
  collectionChannel: z.nativeEnum(AssistedCollectionChannel),
});

const saveSchema = z.object({
  responses: z.record(z.unknown()),
});

const submitSchema = z.object({
  responses: z.record(z.unknown()),
  reason: z.string().min(1).max(2000),
});

const correctionSchema = z.object({
  responses: z.record(z.unknown()),
  reason: z.string().min(1).max(2000),
});

async function loadAssistedEntryScoped(
  user: AuthenticatedUser,
  assistedEntryId: string,
  requestId: string,
) {
  const row = await prisma().assistedEntry.findUnique({
    where: { id: assistedEntryId },
    include: { questionnaireResponse: true },
  });
  if (!row) {
    throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Assisted entry not found", {
      requestId,
      details: { assistedEntryId },
    });
  }
  assertProjectAccess(user, row.projectId, requestId);
  return row;
}

function authorizeAssistedOnProject(
  user: AuthenticatedUser,
  projectId: string,
  requestId: string,
): void {
  const actor = resolveActorRoleForProject(user, projectId, requestId);
  authorize(
    { userId: actor.userId, role: actor.role },
    Permission.QuestionnaireAssistedEntry,
    { requestId },
  );
}

export function registerAssistedEntryRoutes(app: FastifyInstance): void {
  app.post<{ Body: z.infer<typeof startSchema> }>(
    "/api/epro/assisted-entries/start",
    async (req) => {
      const user = await requireUser(req);
      const parsed = startSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
          requestId: req.id,
          details: { issues: parsed.error.issues },
        });
      }
      const subject = await prisma().subject.findUnique({
        where: { id: parsed.data.subjectId },
      });
      if (!subject) {
        throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Subject not found", {
          requestId: req.id,
        });
      }
      assertProjectAccess(user, subject.projectId, req.id);
      authorizeAssistedOnProject(user, subject.projectId, req.id);

      const tpl = await prisma().questionnaireTemplate.findUnique({
        where: { id: parsed.data.questionnaireTemplateId },
      });
      if (!tpl || tpl.projectId !== subject.projectId) {
        throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Template not found", {
          requestId: req.id,
        });
      }
      if (parsed.data.visitId) {
        const visit = await prisma().visit.findUnique({
          where: { id: parsed.data.visitId },
          select: { subjectId: true },
        });
        if (!visit || visit.subjectId !== subject.id) {
          throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Visit not found", {
            requestId: req.id,
            details: { visitId: parsed.data.visitId },
          });
        }
      }

      const result = await prisma().$transaction(async (tx) => {
        const response = await tx.questionnaireResponse.create({
          data: {
            subjectId: subject.id,
            visitId: parsed.data.visitId ?? null,
            questionnaireTemplateId: tpl.id,
            status: QuestionnaireStatus.Scheduled,
            entryChannel: DataEntryChannel.AssistedEntry,
            responses: {},
          },
        });
        const assisted = await tx.assistedEntry.create({
          data: {
            projectId: subject.projectId,
            subjectId: subject.id,
            recorderUserId: user.userId,
            reason: parsed.data.reason,
            collectionChannel: parsed.data.collectionChannel,
            instrumentType: "QuestionnaireResponse",
            questionnaireResponseId: response.id,
            templateId: tpl.id,
            templateCode: tpl.code,
            templateVersion: tpl.version,
          },
        });
        await auditTx(
          tx,
          req,
          user,
          AuditAction.Create,
          "AssistedEntry",
          assisted.id,
          {
            subjectId: subject.id,
            templateId: tpl.id,
            collectionChannel: parsed.data.collectionChannel,
            entryChannel: DataEntryChannel.AssistedEntry,
            dataOrigin: "AssistedEntry",
          },
          { projectId: subject.projectId, reason: parsed.data.reason },
        );
        return { assisted, response };
      });

      return {
        assistedEntryId: result.assisted.id,
        responseId: result.response.id,
        status: result.response.status,
        entryChannel: DataEntryChannel.AssistedEntry,
        dataOrigin: "AssistedEntry",
      };
    },
  );

  app.patch<{
    Params: { assistedEntryId: string };
    Body: z.infer<typeof saveSchema>;
  }>("/api/epro/assisted-entries/:assistedEntryId/save", async (req) => {
    const user = await requireUser(req);
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
        requestId: req.id,
        details: { issues: parsed.error.issues },
      });
    }
    const row = await loadAssistedEntryScoped(user, req.params.assistedEntryId, req.id);
    authorizeAssistedOnProject(user, row.projectId, req.id);
    const resp = row.questionnaireResponse;
    if (
      resp.status !== QuestionnaireStatus.Scheduled &&
      resp.status !== QuestionnaireStatus.InProgress &&
      resp.status !== QuestionnaireStatus.Late
    ) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        `Cannot save assisted entry in status ${resp.status}`,
        { details: { responseId: resp.id, status: resp.status } },
      );
    }
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
        entryChannel: DataEntryChannel.AssistedEntry,
      },
    });
    await audit(req, user, "epro.response.save", "QuestionnaireResponse", resp.id, {
      assistedEntryId: row.id,
      entryChannel: DataEntryChannel.AssistedEntry,
      answerCount: Object.keys(parsed.data.responses).length,
      dataOrigin: "AssistedEntry",
    }, { projectId: row.projectId });
    return { responseId: updated.id, status: updated.status };
  });

  app.post<{
    Params: { assistedEntryId: string };
    Body: z.infer<typeof submitSchema>;
  }>("/api/epro/assisted-entries/:assistedEntryId/submit", async (req) => {
    const user = await requireUser(req);
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
        requestId: req.id,
        details: { issues: parsed.error.issues },
      });
    }
    const row = await loadAssistedEntryScoped(user, req.params.assistedEntryId, req.id);
    authorizeAssistedOnProject(user, row.projectId, req.id);
    const resp = row.questionnaireResponse;
    assertQuestionnaireTransition(resp.status, QuestionnaireStatus.InProgress);
    assertQuestionnaireTransition(QuestionnaireStatus.InProgress, QuestionnaireStatus.Submitted);

    await prisma().$transaction(async (tx) => {
      await tx.questionnaireResponse.update({
        where: { id: resp.id },
        data: {
          responses: parsed.data.responses as object,
          status: QuestionnaireStatus.Submitted,
          entryChannel: DataEntryChannel.AssistedEntry,
          submittedAt: new Date(),
          submittedByUserId: user.userId,
        },
      });
      await auditTx(
        tx,
        req,
        user,
        AuditAction.Submit,
        "AssistedEntry",
        row.id,
        {
          responseId: resp.id,
          entryChannel: DataEntryChannel.AssistedEntry,
          collectionChannel: row.collectionChannel,
          dataOrigin: "AssistedEntry",
        },
        { projectId: row.projectId, reason: parsed.data.reason },
      );
      await auditTx(
        tx,
        req,
        user,
        "epro.response.submit",
        "QuestionnaireResponse",
        resp.id,
        {
          assistedEntryId: row.id,
          entryChannel: DataEntryChannel.AssistedEntry,
          dataOrigin: "AssistedEntry",
        },
        { projectId: row.projectId },
      );
    });

    return {
      assistedEntryId: row.id,
      responseId: resp.id,
      status: QuestionnaireStatus.Submitted,
      entryChannel: DataEntryChannel.AssistedEntry,
      dataOrigin: "AssistedEntry",
    };
  });

  app.post<{
    Params: { assistedEntryId: string };
    Body: z.infer<typeof correctionSchema>;
  }>("/api/epro/assisted-entries/:assistedEntryId/corrections", async (req) => {
    const user = await requireUser(req);
    const parsed = correctionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
        requestId: req.id,
        details: { issues: parsed.error.issues },
      });
    }
    const row = await loadAssistedEntryScoped(user, req.params.assistedEntryId, req.id);
    authorizeAssistedOnProject(user, row.projectId, req.id);
    const resp = row.questionnaireResponse;
    if (resp.status !== QuestionnaireStatus.Submitted && resp.status !== QuestionnaireStatus.Reviewed) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Corrections apply only after assisted entry submission",
        { details: { status: resp.status } },
      );
    }
    const beforeValue = resp.responses;

    await prisma().$transaction(async (tx) => {
      await tx.assistedEntryCorrection.create({
        data: {
          assistedEntryId: row.id,
          actorUserId: user.userId,
          reason: parsed.data.reason,
          beforeValue: beforeValue as object,
          afterValue: parsed.data.responses as object,
        },
      });
      await tx.questionnaireResponse.update({
        where: { id: resp.id },
        data: {
          responses: parsed.data.responses as object,
          entryChannel: DataEntryChannel.AssistedEntry,
        },
      });
      await auditTx(
        tx,
        req,
        user,
        AuditAction.Update,
        "AssistedEntry",
        row.id,
        {
          responseId: resp.id,
          dataOrigin: "AssistedEntry",
        },
        { projectId: row.projectId, reason: parsed.data.reason, beforeValue },
      );
    });

    return { assistedEntryId: row.id, responseId: resp.id, corrected: true };
  });

  app.get<{ Params: { assistedEntryId: string } }>(
    "/api/epro/assisted-entries/:assistedEntryId",
    async (req) => {
      const user = await requireUser(req);
      const row = await loadAssistedEntryScoped(user, req.params.assistedEntryId, req.id);
      const reader = resolveActorRoleForProject(user, row.projectId, req.id);
      authorize(
        { userId: reader.userId, role: reader.role },
        Permission.QuestionnaireRead,
        { requestId: req.id },
      );
      const [recorder, corrections] = await Promise.all([
        prisma().user.findUnique({
          where: { id: row.recorderUserId },
          select: { id: true, displayName: true },
        }),
        prisma().assistedEntryCorrection.findMany({
          where: { assistedEntryId: row.id },
          orderBy: { correctedAt: "asc" },
          include: { actor: { select: { displayName: true } } },
        }),
      ]);
      return {
        assistedEntry: {
          id: row.id,
          subjectId: row.subjectId,
          reason: row.reason,
          collectionChannel: row.collectionChannel,
          instrumentType: row.instrumentType,
          templateCode: row.templateCode,
          templateVersion: row.templateVersion,
          recordedAt: row.recordedAt.toISOString(),
          recorder: recorder
            ? { id: recorder.id, displayName: recorder.displayName }
            : null,
          responseId: row.questionnaireResponseId,
          entryChannel: DataEntryChannel.AssistedEntry,
          dataOrigin: "AssistedEntry",
        },
        corrections: corrections.map((c) => ({
          id: c.id,
          reason: c.reason,
          actorName: c.actor.displayName,
          correctedAt: c.correctedAt.toISOString(),
        })),
      };
    },
  );
}