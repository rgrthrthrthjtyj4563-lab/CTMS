/**
 * M4A — Subject source-data portal.
 *
 * All routes derive scope from the authenticated Subject identity; client-
 * supplied subjectId / projectId MUST NOT widen access.
 *
 *   GET  /api/subject/me
 *   GET  /api/subject/my-tasks
 *   GET  /api/subject/epro/responses
 *   GET  /api/subject/epro/responses/:responseId
 *   POST /api/subject/epro/responses
 *   PATCH /api/subject/epro/responses/:responseId
 *   POST /api/subject/epro/responses/:responseId/submit
 *   POST /api/subject/symptom-reports
 *   GET  /api/subject/symptom-reports/:reportId
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  ConsentStatus,
  DataEntryChannel,
  Permission,
  QuestionnaireStatus,
  RiskLevel,
  RiskStatus,
  SafetyEventStatus,
  SymptomReportStatus,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  assertQuestionnaireTransition,
  audit,
  auditTx,
  requireSubjectActor,
  type SubjectIdentity,
} from "../lib/auth.js";

const URGENT_CARE_GUIDANCE =
  "如果您感到严重不适或需要紧急医疗帮助，请立即拨打急救电话或前往最近的急诊科。本系统报告不能替代紧急医疗服务。";

const startEproSchema = z.object({
  questionnaireTemplateId: z.string().min(1),
  visitId: z.string().optional(),
});

const saveEproSchema = z.object({
  responses: z.record(z.unknown()),
});

const submitEproSchema = z.object({
  responses: z.record(z.unknown()),
});

const symptomDraftSchema = z.object({
  discomfortType: z.string().min(1).max(120),
  onsetAt: z.string().datetime(),
  severity: z.nativeEnum(RiskLevel),
  soughtMedicalCare: z.boolean().optional(),
  hospitalized: z.boolean().optional(),
  stoppedMedication: z.boolean().optional(),
  description: z.string().min(1).max(2000),
});

const symptomSubmitSchema = symptomDraftSchema.extend({
  submit: z.literal(true).optional(),
});

function isSevereSymptom(input: {
  severity: RiskLevel;
  soughtMedicalCare?: boolean;
  hospitalized?: boolean;
}): boolean {
  return (
    input.hospitalized === true ||
    input.soughtMedicalCare === true ||
    input.severity === RiskLevel.High ||
    input.severity === RiskLevel.Critical
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function loadOwnResponse(
  identity: SubjectIdentity,
  responseId: string,
  requestId: string,
) {
  const resp = await prisma().questionnaireResponse.findUnique({
    where: { id: responseId },
  });
  if (!resp || resp.subjectId !== identity.subjectId) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Response not found",
      { requestId, details: { responseId } },
    );
  }
  return resp;
}

async function assertOwnedVisit(
  identity: SubjectIdentity,
  visitId: string,
  requestId: string,
): Promise<void> {
  const visit = await prisma().visit.findUnique({
    where: { id: visitId },
    select: { subjectId: true },
  });
  if (!visit || visit.subjectId !== identity.subjectId) {
    throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Visit not found", {
      requestId,
      details: { visitId },
    });
  }
}

async function loadOwnSymptomReport(
  identity: SubjectIdentity,
  reportId: string,
  requestId: string,
) {
  const report = await prisma().symptomReport.findUnique({
    where: { id: reportId },
  });
  if (!report || report.subjectId !== identity.subjectId) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Symptom report not found",
      { requestId, details: { reportId } },
    );
  }
  return report;
}

export function registerSubjectPortalRoutes(app: FastifyInstance): void {
  app.get("/api/subject/me", async (req) => {
    const { identity } = await requireSubjectActor(req, Permission.SubjectReadMasked);
    const [subject, project] = await Promise.all([
      prisma().subject.findUnique({
        where: { id: identity.subjectId },
        select: {
          id: true,
          subjectCode: true,
          status: true,
          enrollmentDate: true,
          site: { select: { code: true, name: true } },
        },
      }),
      prisma().project.findUnique({
        where: { id: identity.projectId },
        select: { id: true, code: true, name: true, phase: true },
      }),
    ]);
    if (!subject || !project) {
      throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Subject context not found", {
        requestId: req.id,
      });
    }
    return {
      identity: {
        userId: user.userId,
        displayName: user.displayName,
        role: user.role,
      },
      subject: {
        id: subject.id,
        subjectCode: subject.subjectCode,
        status: subject.status,
        enrollmentDate: subject.enrollmentDate?.toISOString() ?? null,
        site: subject.site,
      },
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        phase: project.phase,
      },
      dataOrigin: "SubjectSelfReport",
    };
  });

  app.get("/api/subject/my-tasks", async (req) => {
    const { identity } = await requireSubjectActor(req, Permission.SubjectTasksRead);
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const [questionnaires, visits, consentTasks] = await Promise.all([
      prisma().questionnaireResponse.findMany({
        where: {
          subjectId: identity.subjectId,
          status: {
            in: [
              QuestionnaireStatus.Scheduled,
              QuestionnaireStatus.InProgress,
              QuestionnaireStatus.Late,
              QuestionnaireStatus.Submitted,
              QuestionnaireStatus.Reviewed,
            ],
          },
        },
        include: {
          template: { select: { id: true, code: true, name: true, version: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma().visit.findMany({
        where: { subjectId: identity.subjectId },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma().consentTask.findMany({
        where: {
          subjectId: identity.subjectId,
          status: { notIn: [ConsentStatus.Completed, ConsentStatus.Withdrawn] },
        },
        include: {
          document: { select: { id: true, title: true, version: true } },
        },
      }),
    ]);

    type TaskItem = {
      id: string;
      kind: "questionnaire" | "visit" | "consent";
      title: string;
      status: string;
      dueAt: string | null;
      bucket: "overdue" | "today" | "upcoming" | "completed";
      entryChannel?: string;
    };

    const items: TaskItem[] = [];

    for (const q of questionnaires) {
      const dueAt = q.updatedAt;
      let bucket: TaskItem["bucket"] = "upcoming";
      if (
        q.status === QuestionnaireStatus.Submitted ||
        q.status === QuestionnaireStatus.Reviewed
      ) {
        bucket = "completed";
      } else if (q.status === QuestionnaireStatus.Late) {
        bucket = "overdue";
      } else if (dueAt >= todayStart && dueAt <= todayEnd) {
        bucket = "today";
      } else if (dueAt < todayStart) {
        bucket = "overdue";
      }
      items.push({
        id: q.id,
        kind: "questionnaire",
        title: `${q.template.name} (${q.template.version})`,
        status: q.status,
        dueAt: dueAt.toISOString(),
        bucket,
        entryChannel: q.entryChannel,
      });
    }

    for (const v of visits) {
      let bucket: TaskItem["bucket"] = "upcoming";
      if (v.status === "Completed" || v.status === "SubmittedForPI") {
        bucket = "completed";
      } else if (v.scheduledAt < todayStart && v.status !== "Missed") {
        bucket = "overdue";
      } else if (v.scheduledAt >= todayStart && v.scheduledAt <= todayEnd) {
        bucket = "today";
      } else if (v.status === "Missed" || v.status === "OutOfWindow") {
        bucket = "overdue";
      }
      items.push({
        id: v.id,
        kind: "visit",
        title: `访视 ${v.visitCode}`,
        status: v.status,
        dueAt: v.scheduledAt.toISOString(),
        bucket,
      });
    }

    for (const c of consentTasks) {
      items.push({
        id: c.id,
        kind: "consent",
        title: c.document.title,
        status: c.status,
        dueAt: c.updatedAt.toISOString(),
        bucket: c.status === "NotStarted" ? "today" : "upcoming",
      });
    }

    const grouped = {
      overdue: items.filter((i) => i.bucket === "overdue"),
      today: items.filter((i) => i.bucket === "today"),
      upcoming: items.filter((i) => i.bucket === "upcoming"),
      completed: items.filter((i) => i.bucket === "completed"),
    };

    return {
      subjectId: identity.subjectId,
      dataOrigin: "SubjectSelfReport",
      grouped,
      total: items.length,
    };
  });

  app.get("/api/subject/epro/responses", async (req) => {
    const { identity } = await requireSubjectActor(req, Permission.QuestionnaireRead);
    const rows = await prisma().questionnaireResponse.findMany({
      where: { subjectId: identity.subjectId },
      include: {
        template: { select: { code: true, name: true, version: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        entryChannel: r.entryChannel,
        templateCode: r.template.code,
        templateName: r.template.name,
        templateVersion: r.template.version,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });

  app.get<{ Params: { responseId: string } }>(
    "/api/subject/epro/responses/:responseId",
    async (req) => {
      const { identity } = await requireSubjectActor(req, Permission.QuestionnaireRead);
      const resp = await loadOwnResponse(identity, req.params.responseId, req.id);
      const template = await prisma().questionnaireTemplate.findUnique({
        where: { id: resp.questionnaireTemplateId },
      });
      return {
        response: {
          id: resp.id,
          status: resp.status,
          entryChannel: resp.entryChannel,
          responses: resp.responses as Record<string, unknown>,
          submittedAt: resp.submittedAt?.toISOString() ?? null,
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
      };
    },
  );

  app.post<{ Body: z.infer<typeof startEproSchema> }>(
    "/api/subject/epro/responses",
    async (req) => {
      const { user, identity } = await requireSubjectActor(req, Permission.QuestionnaireSubmit);
      const parsed = startEproSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
          requestId: req.id,
          details: { issues: parsed.error.issues },
        });
      }
      const tpl = await prisma().questionnaireTemplate.findUnique({
        where: { id: parsed.data.questionnaireTemplateId },
      });
      if (!tpl || tpl.projectId !== identity.projectId) {
        throw new ApiErrorException(ApiErrorCode.NOT_FOUND, "Template not found", {
          requestId: req.id,
        });
      }
      if (parsed.data.visitId) {
        await assertOwnedVisit(identity, parsed.data.visitId, req.id);
      }
      const resp = await prisma().questionnaireResponse.create({
        data: {
          subjectId: identity.subjectId,
          visitId: parsed.data.visitId ?? null,
          questionnaireTemplateId: tpl.id,
          status: QuestionnaireStatus.Scheduled,
          entryChannel: DataEntryChannel.SubjectSelfReport,
          responses: {},
        },
      });
      await audit(req, user, "epro.response.create", "QuestionnaireResponse", resp.id, {
        subjectId: identity.subjectId,
        templateId: tpl.id,
        entryChannel: DataEntryChannel.SubjectSelfReport,
      }, { projectId: identity.projectId });
      return { id: resp.id, status: resp.status, entryChannel: resp.entryChannel };
    },
  );

  app.patch<{
    Params: { responseId: string };
    Body: z.infer<typeof saveEproSchema>;
  }>("/api/subject/epro/responses/:responseId", async (req) => {
    const { user, identity } = await requireSubjectActor(req, Permission.QuestionnaireSubmit);
    const parsed = saveEproSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
        requestId: req.id,
        details: { issues: parsed.error.issues },
      });
    }
    const resp = await loadOwnResponse(identity, req.params.responseId, req.id);
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
        entryChannel: DataEntryChannel.SubjectSelfReport,
      },
    });
    await audit(req, user, "epro.response.save", "QuestionnaireResponse", resp.id, {
      status: updated.status,
      entryChannel: DataEntryChannel.SubjectSelfReport,
      answerCount: Object.keys(parsed.data.responses).length,
    }, { projectId: identity.projectId });
    return { id: updated.id, status: updated.status };
  });

  app.post<{
    Params: { responseId: string };
    Body: z.infer<typeof submitEproSchema>;
  }>("/api/subject/epro/responses/:responseId/submit", async (req) => {
    const { user, identity } = await requireSubjectActor(req, Permission.QuestionnaireSubmit);
    const parsed = submitEproSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
        requestId: req.id,
        details: { issues: parsed.error.issues },
      });
    }
    const resp = await loadOwnResponse(identity, req.params.responseId, req.id);
    assertQuestionnaireTransition(resp.status, QuestionnaireStatus.InProgress);
    assertQuestionnaireTransition(QuestionnaireStatus.InProgress, QuestionnaireStatus.Submitted);
    const updated = await prisma().questionnaireResponse.update({
      where: { id: resp.id },
      data: {
        responses: parsed.data.responses as object,
        status: QuestionnaireStatus.Submitted,
        entryChannel: DataEntryChannel.SubjectSelfReport,
        submittedAt: new Date(),
        submittedByUserId: user.userId,
      },
    });
    await audit(req, user, "epro.response.submit", "QuestionnaireResponse", resp.id, {
      entryChannel: DataEntryChannel.SubjectSelfReport,
      answerCount: Object.keys(parsed.data.responses).length,
      dataOrigin: "SubjectSelfReport",
    }, { projectId: identity.projectId });
    return {
      id: updated.id,
      status: updated.status,
      entryChannel: updated.entryChannel,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
    };
  });

  app.post<{ Body: z.infer<typeof symptomSubmitSchema> }>(
    "/api/subject/symptom-reports",
    async (req) => {
      const { user, identity } = await requireSubjectActor(req, Permission.SymptomReport);
      const parsed = symptomSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(ApiErrorCode.VALIDATION_ERROR, "Bad body", {
          requestId: req.id,
          details: { issues: parsed.error.issues },
        });
      }
      const severe = isSevereSymptom(parsed.data);
      const onsetAt = new Date(parsed.data.onsetAt);
      const reportBase = {
        subjectId: identity.subjectId,
        projectId: identity.projectId,
        status: SymptomReportStatus.Submitted,
        entryChannel: DataEntryChannel.SubjectSelfReport,
        discomfortType: parsed.data.discomfortType,
        onsetAt,
        severity: parsed.data.severity,
        soughtMedicalCare: parsed.data.soughtMedicalCare ?? false,
        hospitalized: parsed.data.hospitalized ?? false,
        stoppedMedication: parsed.data.stoppedMedication ?? false,
        description: parsed.data.description,
        submittedAt: new Date(),
        submittedByUserId: user.userId,
      };

      const { report, riskSignalId, safetyEventId } = await prisma().$transaction(
        async (tx) => {
          const created = await tx.symptomReport.create({ data: reportBase });
          let linkedRiskId: string | null = null;
          let linkedSafetyId: string | null = null;

          if (severe) {
            const risk = await tx.riskSignal.create({
              data: {
                projectId: identity.projectId,
                subjectId: identity.subjectId,
                level:
                  parsed.data.severity === RiskLevel.Critical
                    ? RiskLevel.Critical
                    : RiskLevel.High,
                type: "症状上报",
                objectType: "SymptomReport",
                objectId: created.id,
                trigger: `受试者上报严重症状：${parsed.data.discomfortType}`,
                suggestion: "请 CRC/研究者尽快联系受试者评估并按 SAE/AE 流程处置。",
                status: RiskStatus.Open,
              },
            });
            linkedRiskId = risk.id;

            const safety = await tx.safetyEvent.create({
              data: {
                projectId: identity.projectId,
                subjectId: identity.subjectId,
                onsetAt,
                description: `[Subject symptom report] ${parsed.data.description}`,
                severity: parsed.data.severity,
                status: SafetyEventStatus.Draft,
                isSerious:
                  parsed.data.hospitalized === true ||
                  parsed.data.severity === RiskLevel.Critical,
                createdByUserId: user.userId,
              },
            });
            linkedSafetyId = safety.id;
          }

          const finalReport = await tx.symptomReport.update({
            where: { id: created.id },
            data: {
              riskSignalId: linkedRiskId,
              safetyEventId: linkedSafetyId,
            },
          });

          await auditTx(
            tx,
            req,
            user,
            "symptom.report.submit",
            "SymptomReport",
            finalReport.id,
            {
              entryChannel: DataEntryChannel.SubjectSelfReport,
              severity: parsed.data.severity,
              severe,
              riskSignalId: linkedRiskId,
              safetyEventId: linkedSafetyId,
              dataOrigin: "SubjectSelfReport",
            },
            { projectId: identity.projectId },
          );

          return {
            report: finalReport,
            riskSignalId: linkedRiskId,
            safetyEventId: linkedSafetyId,
          };
        },
      );

      return {
        id: report.id,
        status: report.status,
        entryChannel: report.entryChannel,
        severe,
        riskSignalId,
        safetyEventId,
        urgentCareGuidance: severe ? URGENT_CARE_GUIDANCE : null,
        disclaimer:
          "本系统症状上报用于研究监查与随访协调，不能替代紧急医疗服务或临床诊断。",
      };
    },
  );

  app.get<{ Params: { reportId: string } }>(
    "/api/subject/symptom-reports/:reportId",
    async (req) => {
      const { identity } = await requireSubjectActor(req, Permission.SymptomReport);
      const report = await loadOwnSymptomReport(identity, req.params.reportId, req.id);
      return {
        report: {
          id: report.id,
          status: report.status,
          entryChannel: report.entryChannel,
          discomfortType: report.discomfortType,
          onsetAt: report.onsetAt.toISOString(),
          severity: report.severity,
          soughtMedicalCare: report.soughtMedicalCare,
          hospitalized: report.hospitalized,
          stoppedMedication: report.stoppedMedication,
          description: report.description,
          submittedAt: report.submittedAt?.toISOString() ?? null,
          riskSignalId: report.riskSignalId,
          safetyEventId: report.safetyEventId,
        },
        dataOrigin: "SubjectSelfReport",
      };
    },
  );
}