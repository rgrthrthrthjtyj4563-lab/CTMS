/**
 * Report Center endpoints for Phase 3 (AI 报告中心).
 *
 *   GET    /api/reports                — list with pagination + filters
 *   GET    /api/reports/:reportId      — detail + AIOutput + audit chain
 *   POST   /api/reports                — generate draft (status=Generating; worker → Draft)
 *   POST   /api/reports/:reportId/confirm — Draft → UnderReview → Confirmed (ReportConfirm)
 *   POST   /api/reports/:reportId/export  — Confirmed → Exported (ReportExport + reason + ExportRecord)
 *
 * RBAC: read endpoints use ReportRead (SponsorAdmin / CROPM / CRA / Auditor /
 * SitePI / SiteCRC). Generate needs ReportGenerate (SponsorAdmin / CROPM);
 * confirm needs ReportConfirm (SponsorAdmin / CROPM); export needs
 * ReportExport (SponsorAdmin / CROPM).
 *
 * Lifecycle is guarded by REPORT_STATUS_TRANSITIONS. Confirm is the only
 * action that walks multiple legal transitions (Draft → UnderReview →
 * Confirmed) atomically; we write one AuditEvent per transition so the
 * audit chain can replay the user's intent step-by-step. Export is the
 * critical "exfiltration" step — ReportDraft.Export is in
 * CRITICAL_AUDIT_PAIRS with requiresReason, and we ALSO write an
 * ExportRecord row that captures the format / objectIds / reason.
 *
 * Generate follows the protocol activate pattern: audit-before-mutate is
 * unnecessary here because creating a row is not a state transition, so
 * we create the row, audit the create, and the worker picks it up on
 * its next tick. The 501 mock worker in tests must be invoked manually.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AuditAction,
  Permission,
  ReportStatus,
  authorize,
  canTransition,
  REPORT_STATUS_TRANSITIONS,
  type ReportStatus as ReportStatusT,
} from "@aic-dct/domain";
import type {
  AIOutput,
  AuditEvent,
  ExportRecord,
  ReportDraft,
} from "@prisma/client";
import { prisma } from "../db.js";
import { audit, requireUser } from "../lib/auth.js";

const REPORT_TYPES = ["Interim", "Final", "Safety", "Custom"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_FORMATS = ["CSV", "PDF", "XLSX", "JSON"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  type: z.enum(REPORT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const generateSchema = z.object({
  type: z.enum(REPORT_TYPES).default("Interim"),
  /** Optional human hint; surfaced on the AI output's payload summary. */
  notes: z.string().max(2000).optional(),
});

const exportSchema = z.object({
  reason: z.string().min(1).max(2000),
  format: z.enum(REPORT_FORMATS).default("PDF"),
});

function assertReportTransition(
  from: ReportStatusT,
  to: ReportStatusT,
): void {
  if (!canTransition(REPORT_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.STATE_TRANSITION_INVALID,
      `Illegal report status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

async function loadReportScoped(
  user: { projectId: string },
  reportId: string,
) {
  const report = await prisma().reportDraft.findUnique({
    where: { id: reportId },
  });
  if (!report) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Report not found",
      { details: { reportId } },
    );
  }
  if (report.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Report belongs to a different project",
      { details: { reportId } },
    );
  }
  return report;
}

export function registerReportRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/reports",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ReportRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, status, type, page, pageSize } = parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().reportDraft.findMany({
          where,
          orderBy: [{ generatedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().reportDraft.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((row: ReportDraft) => ({
          id: row.id,
          projectId: row.projectId,
          type: row.type,
          status: row.status,
          sourceSnapshotId: row.sourceSnapshotId ?? null,
          generatedAt: row.generatedAt.toISOString(),
          confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
          exportedAt: row.exportedAt ? row.exportedAt.toISOString() : null,
        })),
      };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { reportId: string } }>(
    "/api/reports/:reportId",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ReportRead, { requestId: req.id });
      const report = await loadReportScoped(user, req.params.reportId);
      // Pull the linked AIOutput (the snapshot used to draft the report)
      // and the audit chain. We keep these two independent so a missing
      // AIOutput (e.g. Failed report) doesn't break the detail view.
      const [aiOutput, auditTrail, exportRecord] = await Promise.all([
        report.sourceSnapshotId
          ? prisma().aIOutput.findUnique({
              where: { id: report.sourceSnapshotId },
            })
          : Promise.resolve(null),
        prisma().auditEvent.findMany({
          where: { objectType: "ReportDraft", objectId: report.id },
          orderBy: { timestamp: "desc" },
        }),
        prisma().exportRecord.findFirst({
          where: { objectType: "ReportDraft", objectIds: { equals: [report.id] } },
          orderBy: { exportedAt: "desc" },
        }),
      ]);
      return {
        report: {
          id: report.id,
          projectId: report.projectId,
          type: report.type,
          status: report.status,
          sourceSnapshotId: report.sourceSnapshotId ?? null,
          generatedAt: report.generatedAt.toISOString(),
          confirmedAt: report.confirmedAt ? report.confirmedAt.toISOString() : null,
          exportedAt: report.exportedAt ? report.exportedAt.toISOString() : null,
        },
        aiOutput: aiOutput ? serializeAIOutput(aiOutput) : null,
        exportRecord: exportRecord ? serializeExportRecord(exportRecord) : null,
        auditTrail: auditTrail.map((a: AuditEvent) => ({
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

  /* ─── Generate (SponsorAdmin / CROPM only) ───────────── */
  app.post<{ Body: z.infer<typeof generateSchema> }>(
    "/api/reports",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ReportGenerate, { requestId: req.id });
      const parsed = generateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      // Create the row in Generating; the worker flips it to Draft
      // asynchronously. We intentionally do NOT use audit-before-mutate
      // here: there is no state transition to guard — the row simply
      // appears in Generating, the worker picks it up, and an audit
      // event for the create is written.
      const created = await prisma().reportDraft.create({
        data: {
          projectId: user.projectId,
          type: parsed.data.type,
          status: ReportStatus.Generating,
        },
      });
      await audit(
        req,
        user,
        AuditAction.Create,
        "ReportDraft",
        created.id,
        {
          to: created.status,
          type: created.type,
          notes: parsed.data.notes ?? null,
        },
      );
      return {
        id: created.id,
        projectId: created.projectId,
        type: created.type,
        status: created.status,
        generatedAt: created.generatedAt.toISOString(),
      };
    },
  );

  /* ─── Confirm (Draft → UnderReview → Confirmed) ──────── */
  app.post<{ Params: { reportId: string } }>(
    "/api/reports/:reportId/confirm",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ReportConfirm, { requestId: req.id });
      const report = await loadReportScoped(user, req.params.reportId);
      // Two consecutive legal transitions. The intermediate UnderReview
      // state is recorded in the audit chain but does not require a
      // separate user action — the report goes from "AI 草稿" to "人工
      // 已确认" in one click.
      assertReportTransition(report.status, ReportStatus.UnderReview);
      assertReportTransition(ReportStatus.UnderReview, ReportStatus.Confirmed);
      const now = new Date();
      // Audit-before-mutate (protocol activate pattern): ensure the
      // confirm audit event writes successfully before flipping status.
      // The intermediate Draft→UnderReview transition is also audited.
      await Promise.all([
        audit(
          req,
          user,
          AuditAction.StatusChange,
          "ReportDraft",
          report.id,
          { to: ReportStatus.UnderReview },
          { beforeValue: { status: report.status } },
        ),
        audit(
          req,
          user,
          AuditAction.Confirm,
          "ReportDraft",
          report.id,
          {
            to: ReportStatus.Confirmed,
            notes: "Operator confirmed the AI-generated draft.",
          },
          { beforeValue: { status: ReportStatus.UnderReview } },
        ),
      ]);
      const updated = await prisma().reportDraft.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.Confirmed,
          confirmedAt: now,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        confirmedAt: updated.confirmedAt?.toISOString() ?? null,
      };
    },
  );

  /* ─── Export (Confirmed → Exported; requires reason) ── */
  app.post<{
    Params: { reportId: string };
    Body: z.infer<typeof exportSchema>;
  }>("/api/reports/:reportId/export", async (req) => {
    const user = await requireUser(req);
    authorize(user, Permission.ReportExport, { requestId: req.id });
    const parsed = exportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const report = await loadReportScoped(user, req.params.reportId);
    assertReportTransition(report.status, ReportStatus.Exported);
    const now = new Date();
    // audit-before-mutate: write the ExportRecord + the critical ReportExport
    // audit event first. The audit() helper enforces the non-empty reason
    // (CRITICAL_AUDIT_PAIRS marks ReportDraft.Export as requiresReason).
    const exportRecord = await prisma().exportRecord.create({
      data: {
        projectId: report.projectId,
        objectType: "ReportDraft",
        objectIds: [report.id],
        format: parsed.data.format,
        reason: parsed.data.reason,
        exportedByUserId: user.userId,
      },
    });
    await audit(
      req,
      user,
      AuditAction.Export,
      "ReportDraft",
      report.id,
      {
        to: ReportStatus.Exported,
        format: parsed.data.format,
        exportRecordId: exportRecord.id,
      },
      {
        beforeValue: { status: report.status },
        reason: parsed.data.reason,
      },
    );
    const updated = await prisma().reportDraft.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.Exported,
        exportedAt: now,
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      exportedAt: updated.exportedAt?.toISOString() ?? null,
      exportRecordId: exportRecord.id,
    };
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

function serializeExportRecord(rec: ExportRecord): Record<string, unknown> {
  return {
    id: rec.id,
    projectId: rec.projectId,
    objectType: rec.objectType,
    objectIds: rec.objectIds,
    format: rec.format,
    reason: rec.reason,
    exportedByUserId: rec.exportedByUserId,
    exportedAt: rec.exportedAt.toISOString(),
  };
}
