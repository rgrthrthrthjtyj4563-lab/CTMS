/**
 * Protocol version endpoints for Phase 3 (AI 方案解析工作台).
 *
 *   GET    /api/protocol/versions                       — list with pagination + project filter
 *   GET    /api/protocol/versions/:versionId            — detail + parseResults + linked AIOutput + audit
 *   POST   /api/protocol/versions                       — upload new version (parseStatus=Uploaded)
 *   POST   /api/protocol/versions/:versionId/parse      — trigger AI parse (Uploaded → Parsing; worker picks up)
 *   POST   /api/protocol/versions/:versionId/activate   — activate (UnderReview → Effective), supersedes prior Effective
 *
 * RBAC: read endpoints require ProjectRead; upload requires ProtocolParse
 * (SponsorAdmin / CROPM); activate requires ProtocolActivate (SponsorAdmin /
 * CROPM) plus a server-validated reason. Auditor / CRA / SitePI / SiteCRC /
 * Subject may read but not mutate.
 *
 * Lifecycle is guarded by PROTOCOL_PARSE_TRANSITIONS. Activating a version
 * flips the previously Effective version to Superseded (immutable after
 * activation). Critical actions (activate / supersede) are recorded as
 * AuditEvent with beforeValue + reason (CRITICAL_AUDIT_PAIRS already covers
 * ProtocolActivated and ProtocolSuperseded with requiresReason: true).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AuditAction,
  Permission,
  ProtocolParseStatus,
  authorize,
  canTransition,
  PROTOCOL_PARSE_TRANSITIONS,
  type ProtocolParseStatus as ProtocolParseStatusT,
} from "@aic-dct/domain";
import type {
  AIOutput,
  AIProtocolParseResult,
  AuditEvent,
  ProtocolVersion,
  User,
} from "@prisma/client";
import { prisma } from "../db.js";
import { audit, requireUser } from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  parseStatus: z.nativeEnum(ProtocolParseStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const uploadSchema = z.object({
  projectId: z.string().min(1),
  version: z.string().min(1).max(40),
  documentUrl: z.string().url().max(2000),
});

const activateSchema = z.object({
  reason: z.string().min(1).max(2000),
});

function assertProtocolTransition(
  from: ProtocolParseStatusT,
  to: ProtocolParseStatusT,
): void {
  if (!canTransition(PROTOCOL_PARSE_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.STATE_TRANSITION_INVALID,
      `Illegal protocol parse transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

async function loadVersionScoped(
  user: { projectId: string },
  versionId: string,
) {
  const version = await prisma().protocolVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Protocol version not found",
      { details: { versionId } },
    );
  }
  if (version.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Protocol version belongs to a different project",
      { details: { versionId } },
    );
  }
  return version;
}

export function registerProtocolRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/protocol/versions",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ProjectRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, parseStatus, page, pageSize } = parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
        ...(parseStatus ? { parseStatus } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().protocolVersion.findMany({
          where,
          orderBy: [{ uploadedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().protocolVersion.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((row: ProtocolVersion) => ({
          id: row.id,
          projectId: row.projectId,
          version: row.version,
          documentUrl: row.documentUrl,
          parseStatus: row.parseStatus,
          effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString() : null,
          supersededAt: row.supersededAt ? row.supersededAt.toISOString() : null,
          uploadedAt: row.uploadedAt.toISOString(),
        })),
      };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { versionId: string } }>(
    "/api/protocol/versions/:versionId",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ProjectRead, { requestId: req.id });
      const version = await loadVersionScoped(user, req.params.versionId);
      const [parseResults, auditTrail] = await Promise.all([
        prisma().aIProtocolParseResult.findMany({
          where: { protocolVersionId: version.id },
          orderBy: { generatedAt: "desc" },
          include: {
            aiOutput: true,
          },
        }),
        prisma().auditEvent.findMany({
          where: { objectType: "ProtocolVersion", objectId: version.id },
          orderBy: { timestamp: "desc" },
        }),
      ]);
      type Result = AIProtocolParseResult & { aiOutput: AIOutput | null };
      type Trail = AuditEvent;
      return {
        version: {
          id: version.id,
          projectId: version.projectId,
          version: version.version,
          documentUrl: version.documentUrl,
          parseStatus: version.parseStatus,
          effectiveFrom: version.effectiveFrom ? version.effectiveFrom.toISOString() : null,
          supersededAt: version.supersededAt ? version.supersededAt.toISOString() : null,
          uploadedAt: version.uploadedAt.toISOString(),
        },
        parseResults: parseResults.map((r: Result) => ({
          id: r.id,
          status: r.status,
          fields: r.fields,
          confidence: r.confidence,
          generatedAt: r.generatedAt.toISOString(),
          confirmedByUserId: r.confirmedByUserId ?? null,
          confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
          notes: r.notes ?? null,
          aiOutputId: r.aiOutputId ?? null,
          aiOutput: r.aiOutput
            ? {
                id: r.aiOutput.id,
                kind: r.aiOutput.kind,
                confidence: r.aiOutput.confidence,
                confidenceLevel: r.aiOutput.confidenceLevel,
                status: r.aiOutput.status,
                model: r.aiOutput.model,
                modelVersion: r.aiOutput.modelVersion,
                payload: r.aiOutput.payload,
                generatedAt: r.aiOutput.generatedAt.toISOString(),
              }
            : null,
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

  /* ─── Upload (SponsorAdmin / CROPM only) ──────────────── */
  app.post<{ Body: z.infer<typeof uploadSchema> }>(
    "/api/protocol/versions",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ProtocolParse, { requestId: req.id });
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      if (parsed.data.projectId !== user.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.FORBIDDEN,
          "Cannot upload protocol version to a different project",
          { requestId: req.id, details: { projectId: parsed.data.projectId } },
        );
      }
      // Enforce uniqueness: (projectId, version) is unique in schema.
      // Fail fast with a clean error so the UI can prompt for a new version.
      const existing = await prisma().protocolVersion.findFirst({
        where: {
          projectId: parsed.data.projectId,
          version: parsed.data.version,
        },
      });
      if (existing) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          `Protocol version ${parsed.data.version} already exists in this project`,
          {
            requestId: req.id,
            details: { projectId: parsed.data.projectId, version: parsed.data.version },
          },
        );
      }
      const created = await prisma().protocolVersion.create({
        data: {
          projectId: parsed.data.projectId,
          version: parsed.data.version,
          documentUrl: parsed.data.documentUrl,
          parseStatus: ProtocolParseStatus.Uploaded,
        },
      });
      await audit(
        req,
        user,
        AuditAction.ProtocolUploaded,
        "ProtocolVersion",
        created.id,
        { to: created.parseStatus, version: created.version },
      );
      return {
        id: created.id,
        projectId: created.projectId,
        version: created.version,
        parseStatus: created.parseStatus,
        uploadedAt: created.uploadedAt.toISOString(),
      };
    },
  );

  /* ─── Parse (Uploaded → Parsing; worker picks up) ─────── */
  app.post<{ Params: { versionId: string } }>(
    "/api/protocol/versions/:versionId/parse",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.ProtocolParse, { requestId: req.id });
      const version = await loadVersionScoped(user, req.params.versionId);
      assertProtocolTransition(version.parseStatus, ProtocolParseStatus.Parsing);
      const updated = await prisma().protocolVersion.update({
        where: { id: version.id },
        data: { parseStatus: ProtocolParseStatus.Parsing },
      });
      await audit(
        req,
        user,
        AuditAction.StatusChange,
        "ProtocolVersion",
        updated.id,
        { to: updated.parseStatus },
        { beforeValue: { parseStatus: version.parseStatus } },
      );
      return { id: updated.id, parseStatus: updated.parseStatus };
    },
  );

  /* ─── Activate (UnderReview → Effective; supersede prior) ── */
  app.post<{
    Params: { versionId: string };
    Body: z.infer<typeof activateSchema>;
  }>("/api/protocol/versions/:versionId/activate", async (req) => {
    const user = await requireUser(req);
    authorize(user, Permission.ProtocolActivate, { requestId: req.id });
    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const version = await loadVersionScoped(user, req.params.versionId);
    assertProtocolTransition(version.parseStatus, ProtocolParseStatus.Effective);
    // Find the prior Effective version (if any) so we can flip it to
    // Superseded. The active project's "currently effective" version is
    // the only row with parseStatus=Effective and supersededAt=null.
    const prior = await prisma().protocolVersion.findFirst({
      where: {
        projectId: version.projectId,
        parseStatus: ProtocolParseStatus.Effective,
        supersededAt: null,
      },
    });
    // Write the audit event for the activate transition FIRST so a missing
    // or blank reason (REASON_REQUIRED) aborts before we mutate state. The
    // same applies to the supersede audit on the prior row. Without this
    // ordering, a failed activation would still flip the target row's
    // parseStatus to Effective.
    const writes: Promise<unknown>[] = [];
    if (prior && prior.id !== version.id) {
      // Supersede audit is a separate critical action; reason is shared
      // with the activate action so the trail reads coherently.
      writes.push(
        audit(
          req,
          user,
          AuditAction.ProtocolSuperseded,
          "ProtocolVersion",
          prior.id,
          { to: ProtocolParseStatus.Superseded, successorId: version.id },
          {
            beforeValue: { parseStatus: ProtocolParseStatus.Effective },
            reason: parsed.data.reason,
          },
        ),
      );
    }
    writes.push(
      audit(
        req,
        user,
        AuditAction.ProtocolActivated,
        "ProtocolVersion",
        version.id,
        {
          to: ProtocolParseStatus.Effective,
          predecessorId: prior?.id ?? null,
        },
        {
          beforeValue: { parseStatus: version.parseStatus },
          reason: parsed.data.reason,
        },
      ),
    );
    await Promise.all(writes);
    // Only mutate the DB rows after the audit pair is accepted.
    if (prior && prior.id !== version.id) {
      await prisma().protocolVersion.update({
        where: { id: prior.id },
        data: {
          parseStatus: ProtocolParseStatus.Superseded,
          supersededAt: new Date(),
        },
      });
    }
    const updated = await prisma().protocolVersion.update({
      where: { id: version.id },
      data: {
        parseStatus: ProtocolParseStatus.Effective,
        effectiveFrom: new Date(),
        supersededAt: null,
      },
    });
    return {
      id: updated.id,
      parseStatus: updated.parseStatus,
      effectiveFrom: updated.effectiveFrom?.toISOString() ?? null,
      supersededPriorId: prior?.id ?? null,
    };
  });
}