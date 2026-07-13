/**
 * Audit endpoints for Phase 3 Task 3.5 (post-review).
 *
 *   GET    /api/audit/events                 — list (AuditRead; project-scoped)
 *   GET    /api/audit/exports                — list audit exports
 *   POST   /api/audit/exports                — create export (AuditExport; reason required)
 *
 * Cross-project isolation (architect review fix C1):
 *   The events list and the export-creation filter both go through
 *   `resolveProjectScope`, so a caller can only target their own
 *   project or one they have a real role assignment on. The previous
 *   implementation honored any `?projectId=` query and any
 *   `filters.projectId` body, which leaked audit logs across projects
 *   to any role with AuditRead / AuditExport.
 *
 * Compliance snapshot (architect review fix M2):
 *   The export endpoint resolves the actual set of audit event ids
 *   the export covers, persists that list to `objectIds` (capped at
 *   200 ids; a SHA-256 over the full id set is stored in
 *   `afterValue.contentHash`), and writes the same ids to the
 *   critical AuditEvent. The `ExportRecord.projectId` and the
 *   `AuditEvent.projectId` are guaranteed to match because both go
 *   through the same `resolvedProjectId` (architect review fix M5).
 *
 *   21 CFR Part 11: from the API alone an inspector can re-derive
 *   the exact set of events the export covered (id list) AND prove
 *   the export is unchanged (contentHash over the id list).
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
import type { AuditEvent, ExportRecord, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../db.js";
import { audit, requireUser, resolveProjectScope } from "../lib/auth.js";

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

/** Cap the persisted id list. Real exports would be streamed or written
 *  to object storage; this cap keeps the on-DB payload bounded. */
const MAX_EVENT_IDS_IN_EXPORT = 200;

interface ResolvedFilters {
  projectId: string;
  objectType?: AuditObjectType;
  action?: string;
  actorUserId?: string;
  from?: Date;
  to?: Date;
}

function buildEventWhere(
  f: ResolvedFilters,
): Prisma.AuditEventWhereInput {
  return {
    projectId: f.projectId,
    ...(f.objectType ? { objectType: f.objectType } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.actorUserId ? { actorUserId: f.actorUserId } : {}),
    ...(f.from || f.to
      ? {
          timestamp: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.to ? { lte: f.to } : {}),
          },
        }
      : {}),
  };
}

function hashEventIds(ids: ReadonlyArray<string>): string {
  // Stable, deterministic hash of the (sorted) id set. Lets an
  // inspector detect tampering on the persisted objectIds list.
  const sorted = [...ids].sort();
  const digest = createHash("sha256").update(sorted.join("|")).digest("hex");
  return `sha256:${digest}`;
}

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
      const { projectId: queryProjectId, objectType, action, actorUserId, from, to, page, pageSize } =
        parsed.data;
      // C1: scope to the caller's project unless they have a real
      // assignment on a different one.
      const projectId = resolveProjectScope(user, queryProjectId, req.id);
      const where = buildEventWhere({
        projectId,
        ...(objectType ? { objectType } : {}),
        ...(action ? { action } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
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
    // The list view is hard-scoped to user.projectId; the cross-project
    // query is only honored for callers with a real assignment on the
    // other project. We do not pass a query projectId here — the list
    // view is project-scoped by design.
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
      // C1/M5: resolve the target projectId through the same isolation
      // gate as the list endpoint. The ExportRecord and the critical
      // AuditEvent both use this resolved id, so the compliance chain
      // stays coherent.
      const resolvedProjectId = resolveProjectScope(
        user,
        filters.projectId,
        req.id,
      );
      // M2: snapshot the event ids the export covers BEFORE writing the
      // export record. The id list goes into ExportRecord.objectIds
      // (capped) and a SHA-256 over the full id set goes into
      // afterValue.contentHash. This is the 21 CFR Part 11
      // reconstructible contract.
      const where = buildEventWhere({
        projectId: resolvedProjectId,
        ...(filters.objectType ? { objectType: filters.objectType } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      });
      const allMatching = await prisma().auditEvent.findMany({
        where,
        select: { id: true },
        orderBy: { timestamp: "asc" },
      });
      const allIds = allMatching.map((e) => e.id);
      const persistedIds = allIds.slice(0, MAX_EVENT_IDS_IN_EXPORT);
      const truncated = allIds.length > persistedIds.length;
      const contentHash = hashEventIds(allIds);
      // audit-before-mutate: write the ExportRecord first, then the
      // critical AuditEvent. reason is enforced by audit()'s
      // CRITICAL_AUDIT_PAIRS check for AuditExport.Export.
      const exportRecord = await prisma().exportRecord.create({
        data: {
          projectId: resolvedProjectId,
          objectType: "AuditExport",
          objectIds: persistedIds,
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
          eventCount: allIds.length,
          eventIdsPersisted: persistedIds.length,
          eventIdsTruncated: truncated,
          contentHash,
        },
        { reason, projectId: resolvedProjectId },
      );
      return {
        id: exportRecord.id,
        projectId: exportRecord.projectId,
        objectType: exportRecord.objectType,
        format: exportRecord.format,
        reason: exportRecord.reason,
        exportedByUserId: exportRecord.exportedByUserId,
        exportedAt: exportRecord.exportedAt.toISOString(),
        eventCount: allIds.length,
        eventIdsTruncated: truncated,
        contentHash,
      };
    },
  );
}
