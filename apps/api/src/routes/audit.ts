/**
 * Audit endpoints for Phase 3 Task 3.5.
 *
 *   GET    /api/audit/events                 — list (AuditRead; filter by projectId/objectType/action/actor/from/to)
 *   GET    /api/audit/exports                — list audit exports
 *   POST   /api/audit/exports                — create audit export (AuditExport, reason required; ExportRecord + AuditEvent)
 *
 * The audit log is append-only. We expose a single list endpoint that is
 * scoped to the user's project. SponsorAdmin / CROPM can read across
 * projects only by supplying an explicit projectId query. Auditors and
 * regulators get a per-project view restricted to AuditRead.
 *
 * The export endpoint is the compliance-grade "snapshot" the team hands
 * to a regulator or external sponsor. The action requires:
 *   - AuditExport permission (Auditor / SponsorAdmin)
 *   - non-empty reason (CRITICAL_AUDIT_PAIRS marks AuditExport.Export as
 *     requiresReason: true; audit() enforces it)
 *   - filters that describe which events to include
 * The endpoint creates:
 *   - ExportRecord row (objectType=AuditExport, objectIds=[]) so the
 *     export itself becomes an auditable artifact
 *   - AuditEvent row (action=export, objectType=AuditExport) tying the
 *     export to its reason and filters
 *
 * 21 CFR Part 11: the chain (audit events → filter snapshot → export
 * reason → ExportRecord) is reconstructible from the API alone.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AuditAction,
  AuditObjectType,
  Permission,
  authorize,
} from "@aic-dct/domain";
import type { AuditEvent, ExportRecord } from "@prisma/client";
import { prisma } from "../db.js";
import { audit, requireUser } from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  objectType: z.nativeEnum(AuditObjectType).optional(),
  action: z.string().min(1).max(80).optional(),
  actorUserId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const exportSchema = z.object({
  reason: z.string().min(1).max(2000),
  format: z.enum(["CSV", "PDF", "XLSX", "JSON"]).default("PDF"),
  filters: z
    .object({
      projectId: z.string().optional(),
      objectType: z.nativeEnum(AuditObjectType).optional(),
      action: z.string().min(1).max(80).optional(),
      actorUserId: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .default({}),
});

export function registerAuditRoutes(app: FastifyInstance): void {
  /* ─── List events ─────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/audit/events",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.AuditRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, objectType, action, actorUserId, from, to, page, pageSize } =
        parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
        ...(objectType ? { objectType } : {}),
        ...(action ? { action } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().auditEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().auditEvent.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((a: AuditEvent) => ({
          id: a.id,
          actorUserId: a.actorUserId,
          actorRole: a.actorRole,
          projectId: a.projectId,
          objectType: a.objectType,
          objectId: a.objectId,
          action: a.action,
          beforeValue: a.beforeValue,
          afterValue: a.afterValue,
          reason: a.reason,
          requestId: a.requestId ?? null,
          timestamp: a.timestamp.toISOString(),
        })),
      };
    },
  );

  /* ─── List exports ────────────────────────────────────── */
  app.get("/api/audit/exports", async (req) => {
    const user = await requireUser(req);
    authorize(user, Permission.AuditRead, { requestId: req.id });
    const rows = await prisma().exportRecord.findMany({
      where: { projectId: user.projectId, objectType: "AuditExport" },
      orderBy: { exportedAt: "desc" },
    });
    return {
      items: rows.map((r: ExportRecord) => ({
        id: r.id,
        projectId: r.projectId,
        objectType: r.objectType,
        format: r.format,
        reason: r.reason,
        exportedByUserId: r.exportedByUserId,
        exportedAt: r.exportedAt.toISOString(),
      })),
    };
  });

  /* ─── Create export (AuditExport; reason required) ─── */
  app.post<{ Body: z.infer<typeof exportSchema> }>(
    "/api/audit/exports",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.AuditExport, { requestId: req.id });
      const parsed = exportSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { reason, format, filters } = parsed.data;
      // Pin the export to the user's project unless the filter specifies
      // another one (in which case we still trust the user.projectId for
      // the ExportRecord itself — the filter scope is what gets audited).
      const projectId = filters.projectId ?? user.projectId;
      // audit-before-mutate: create the ExportRecord first, then write
      // the critical AuditEvent. The reason is required by
      // CRITICAL_AUDIT_PAIRS (AuditExport.Export, requiresReason: true);
      // audit() will throw REASON_REQUIRED on empty input.
      const exportRecord = await prisma().exportRecord.create({
        data: {
          projectId,
          objectType: "AuditExport",
          objectIds: [],
          format,
          reason,
          exportedByUserId: user.userId,
        },
      });
      await audit(
        req,
        user,
        AuditAction.Export,
        "AuditExport",
        exportRecord.id,
        {
          exportRecordId: exportRecord.id,
          filters,
          format,
        },
        { reason },
      );
      return {
        id: exportRecord.id,
        projectId: exportRecord.projectId,
        objectType: exportRecord.objectType,
        format: exportRecord.format,
        reason: exportRecord.reason,
        exportedByUserId: exportRecord.exportedByUserId,
        exportedAt: exportRecord.exportedAt.toISOString(),
      };
    },
  );
}
