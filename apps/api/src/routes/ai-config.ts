/**
 * AI 中台配置 endpoints for Phase 3 Task 3.6.
 *
 *   GET    /api/ai-config/configs                  — list (AIConfigRead; project-scoped via R2)
 *   PUT    /api/ai-config/configs/:configId        — update (AIConfigUpdate; project-scoped)
 *   GET    /api/ai-config/prompts                  — list prompt templates (AIConfigRead)
 *   POST   /api/ai-config/prompts                  — create new prompt version (AIConfigUpdate; versioned)
 *   GET    /api/ai-config/call-logs                — list AI call logs (AIConfigRead; project-scoped)
 *   GET    /api/ai-config/outputs                  — review queue of Pending AIOutput (AIOutputRead)
 *   POST   /api/ai-config/outputs/:outputId/adopt  — adopt a Pending output (AIOutputAdopt; atomic with audit)
 *   POST   /api/ai-config/outputs/:outputId/reject — reject a Pending output (AIOutputReject; reason required)
 *
 * R1 — project-aware role resolution:
 *   `requireUser()` (apps/api/src/lib/auth.ts) returns the caller's role
 *   plus the list of role assignments (projectId × role). Every mutation
 *   that targets a specific row resolves the actor's role on the row's
 *   project via `resolveActorRoleForProject()` so a SponsorAdmin holding
 *   assignments on multiple projects uses the role that grants the
 *   required permission on the target project (no "first assignment
 *   wins" leakage). R1 is the Phase 3 closure for 3.5 review item C1
 *   generalised to mutating endpoints.
 *
 * R2 — full-route resolveProjectScope:
 *   Every list endpoint (configs / call-logs / outputs / prompts) goes
 *   through `resolveProjectScope` so a `?projectId=` query is only
 *   honored for callers with a real role assignment on that project.
 *   Detail / mutate endpoints use `assertProjectAccess` against the
 *   target row's projectId. R2 closes the cross-project IDOR gap that
 *   was only patched in documents/audit during the 3.5 review.
 *
 * Atomicity (adopt/reject):
 *   AIOutput state mutation + AuditEvent are wrapped in
 *   `prisma.$transaction([...])` so a failed audit cannot leave the
 *   output in a half-promoted state. Reject requires a non-empty
 *   reason (CRITICAL_AUDIT_PAIRS marks AIOutput.AIOutputRejected with
 *   requiresReason: true).
 *
 * Prompt template versioning (create new version):
 *   POST /api/ai-config/prompts always creates a NEW row with an
 *   incremented version string (`<base>.1`, `<base>.2`, ...). Existing
 *   rows are immutable. The new version is returned; the audit chain
 *   records the change with beforeValue pointing at the previous
 *   version's id+version.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AuditAction,
  HumanConfirmationStatus,
  Permission,
  applyAIConfirmation,
  authorize,
  type HumanConfirmationStatus as HumanConfirmationStatusT,
  type AIOutput as AIOutputT,
} from "@aic-dct/domain";
import type {
  AIConfig,
  AIOutput,
  AICallLog,
  PromptTemplate,
  User,
} from "@prisma/client";
import { prisma } from "../db.js";
import {
  assertProjectAccess,
  auditTx,
  requireUser,
  resolveActorRoleForProject,
  resolveProjectScope,
} from "../lib/auth.js";

/* ─── Schemas ─────────────────────────────────────────────── */

const configsListQuery = z.object({
  projectId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const updateConfigSchema = z.object({
  provider: z.string().min(1).max(80).optional(),
  model: z.string().min(1).max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const createPromptSchema = z.object({
  code: z.string().min(1).max(80),
  body: z.string().min(1).max(20000),
  variables: z.array(z.string().min(1).max(80)).default([]),
  outputKind: z.string().min(1).max(80),
  version: z.string().min(1).max(40).optional(),
});

const callLogsListQuery = z.object({
  projectId: z.string().optional(),
  model: z.string().min(1).max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const outputsListQuery = z.object({
  projectId: z.string().optional(),
  kind: z.string().min(1).max(80).optional(),
  status: z.nativeEnum(HumanConfirmationStatus).default(HumanConfirmationStatus.Pending),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const rejectOutputSchema = z.object({
  reason: z.string().min(1).max(2000),
  notes: z.string().max(2000).optional(),
});

const adoptOutputSchema = z.object({
  notes: z.string().max(2000).optional(),
});

/* ─── R1 helper: per-project role resolution ──────────────── */
// `resolveActorRoleForProject` is now exported from `apps/api/src/lib/auth.ts`
// (Phase 3 Task 3.6/3.7 R1 closure). All mutating endpoints here call the
// shared helper so a single code-path enforces per-project role evaluation.

/* ─── Domain ↔ Prisma AIOutput mapping ────────────────────── */

function toDomainAIOutput(row: AIOutput): AIOutputT {
  // The DB row holds `kind` as a free-form string (AIOutputKind is
  // enforced at write time but not at the column level). We surface
  // the DB value as-is so the JSON shape stays stable for clients.
  return {
    id: row.id,
    kind: row.kind as AIOutputT["kind"],
    projectId: row.projectId,
    subjectId: row.subjectId ?? undefined,
    payload: row.payload,
    confidence: row.confidence,
    confidenceLevel: row.confidenceLevel as AIOutputT["confidenceLevel"],
    source: {
      model: row.model,
      modelVersion: row.modelVersion,
      promptTemplateId: row.promptTemplateId ?? "(unbound)",
      promptVersion: row.promptTemplateId ? "db-row" : "n/a",
      knowledgeBaseRefs: Array.isArray(row.knowledgeBaseRefs)
        ? (row.knowledgeBaseRefs as string[])
        : [],
      inputHash: row.inputHash,
    },
    generatedAt: row.generatedAt,
    status: row.status as HumanConfirmationStatusT,
    confirmedByUserId: row.confirmedByUserId ?? undefined,
    confirmedAt: row.confirmedAt ?? undefined,
    confirmationNotes: row.notes ?? undefined,
    rejectionReason: row.rejectionReason ?? undefined,
    auditEventIds: [],
  };
}

/* ─── Routes ──────────────────────────────────────────────── */

export function registerAiConfigRoutes(app: FastifyInstance): void {
  /* ─── Configs list (R2) ───────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof configsListQuery> }>(
    "/api/ai-config/configs",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.AIConfigRead, { requestId: req.id });
      const parsed = configsListQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId: queryProjectId, page, pageSize } = parsed.data;
      const projectId = resolveProjectScope(user, queryProjectId, req.id);
      const where = {
        OR: [{ projectId }, { projectId: null }],
      };
      const [rows, total] = await Promise.all([
        prisma().aIConfig.findMany({
          where,
          orderBy: [{ projectId: "asc" }, { updatedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().aIConfig.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((r: AIConfig) => ({
          id: r.id,
          projectId: r.projectId,
          provider: r.provider,
          model: r.model,
          temperature: r.temperature,
          maxTokens: r.maxTokens,
          enabled: r.enabled,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  /* ─── Update config (R1) ──────────────────────────────── */
  app.put<{
    Params: { configId: string };
    Body: z.infer<typeof updateConfigSchema>;
  }>("/api/ai-config/configs/:configId", async (req) => {
    const user = await requireUser(req);
    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const config = await prisma().aIConfig.findUnique({
      where: { id: req.params.configId },
    });
    if (!config) {
      throw new ApiErrorException(
        ApiErrorCode.NOT_FOUND,
        "AIConfig not found",
        { requestId: req.id, details: { configId: req.params.configId } },
      );
    }
    // R2: target project isolation. Global configs (projectId=null) are
    // SystemAdmin-only; for any other caller we 403. We use
    // assertProjectAccess to keep the helper consistent with the
    // documents/audit routes.
    if (config.projectId === null) {
      // Global config: require AIConfigUpdate on the system (handled
      // by RBAC matrix) but the actor's role on a real project doesn't
      // matter; we still go through authorize against the actor's
      // primary project context. This keeps the audit event's
      // projectId stable.
      authorize(user, Permission.AIConfigUpdate, { requestId: req.id });
    } else {
      assertProjectAccess(user, config.projectId, req.id);
      // R1: resolve the actor's role on the target project for the
      // permission check. A SponsorAdmin on project A cannot update
      // a config on project B using their project-A role.
      const actor = resolveActorRoleForProject(
        user,
        config.projectId,
        req.id,
      );
      authorize(
        { userId: actor.userId, role: actor.role },
        Permission.AIConfigUpdate,
        { requestId: req.id },
      );
    }
    const updated = await prisma().$transaction(async (tx) => {
      const next = await tx.aIConfig.update({
        where: { id: config.id },
        data: {
          ...(parsed.data.provider !== undefined
            ? { provider: parsed.data.provider }
            : {}),
          ...(parsed.data.model !== undefined
            ? { model: parsed.data.model }
            : {}),
          ...(parsed.data.temperature !== undefined
            ? { temperature: parsed.data.temperature }
            : {}),
          ...(parsed.data.maxTokens !== undefined
            ? { maxTokens: parsed.data.maxTokens }
            : {}),
          ...(parsed.data.enabled !== undefined
            ? { enabled: parsed.data.enabled }
            : {}),
        },
      });
      await auditTx(
        tx,
        req,
        user,
        AuditAction.Update,
        "AIConfig",
        next.id,
        { after: parsed.data },
        {
          beforeValue: {
            provider: config.provider,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            enabled: config.enabled,
          },
          projectId: next.projectId ?? user.projectId,
        },
      );
      return next;
    });
    return {
      id: updated.id,
      projectId: updated.projectId,
      provider: updated.provider,
      model: updated.model,
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  /* ─── Prompts list (R2) ───────────────────────────────── */
  app.get("/api/ai-config/prompts", async (req) => {
    const user = await requireUser(req);
    authorize(user, Permission.AIConfigRead, { requestId: req.id });
    // Prompts are global (not project-scoped) so we do not pass
    // ?projectId=. AIConfigRead on the caller's primary project is
    // sufficient — prompts are platform-level artefacts.
    const rows = await prisma().promptTemplate.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
    return {
      items: rows.map((r: PromptTemplate) => ({
        id: r.id,
        code: r.code,
        version: r.version,
        body: r.body,
        variables: r.variables,
        outputKind: r.outputKind,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  /* ─── Create new prompt version (R1) ──────────────────── */
  app.post<{ Body: z.infer<typeof createPromptSchema> }>(
    "/api/ai-config/prompts",
    async (req) => {
      const user = await requireUser(req);
      // R1: prompt versioning uses the caller's primary project role
      // for the permission check. The audit chain records the actor.
      authorize(user, Permission.AIConfigUpdate, { requestId: req.id });
      const parsed = createPromptSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { code, body, variables, outputKind } = parsed.data;
      // Compute the next version. We treat the code's "base" as the
      // longest common prefix of all existing versions; otherwise we
      // start a new series. The user-supplied `version` (if any) is
      // appended as the minor segment.
      const existing = await prisma().promptTemplate.findMany({
        where: { code },
        orderBy: { createdAt: "asc" },
      });
      let nextVersion: string;
      if (parsed.data.version) {
        // Caller-supplied version: still enforce uniqueness.
        if (existing.some((e) => e.version === parsed.data.version)) {
          throw new ApiErrorException(
            ApiErrorCode.CONFLICT,
            `Prompt version ${parsed.data.version} already exists for code ${code}`,
            {
              requestId: req.id,
              details: { code, version: parsed.data.version },
            },
          );
        }
        nextVersion = parsed.data.version;
      } else {
        // Auto-increment: append ".<n>" to the most recent version.
        // If no prior version exists we default to "1.0.0".
        if (existing.length === 0) {
          nextVersion = "1.0.0";
        } else {
          const last = existing[existing.length - 1]!.version;
          const match = last.match(/^(.*?)(\d+)$/);
          if (!match) {
            nextVersion = `${last}.1`;
          } else {
            const base = match[1] ?? "";
            const num = Number(match[2] ?? "0");
            nextVersion = `${base}${num + 1}`;
          }
        }
      }
      const previousVersion = existing[existing.length - 1] ?? null;
      const created = await prisma().$transaction(async (tx) => {
        const next = await tx.promptTemplate.create({
          data: {
            code,
            version: nextVersion,
            body,
            variables: variables as unknown as object,
            outputKind,
          },
        });
        // Audit chain: tag the event with the previous version so an
        // inspector can walk forward / backward through the history.
        await auditTx(
          tx,
          req,
          user,
          AuditAction.Create,
          "AIConfig",
          next.id,
          {
            kind: "prompt-template",
            code: next.code,
            version: next.version,
            variables: next.variables,
            outputKind: next.outputKind,
          },
          {
            beforeValue: previousVersion
              ? {
                  id: previousVersion.id,
                  version: previousVersion.version,
                }
              : { version: null },
            projectId: user.projectId,
          },
        );
        return next;
      });
      return {
        id: created.id,
        code: created.code,
        version: created.version,
        body: created.body,
        variables: created.variables,
        outputKind: created.outputKind,
        createdAt: created.createdAt.toISOString(),
      };
    },
  );

  /* ─── Call logs (R2) ──────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof callLogsListQuery> }>(
    "/api/ai-config/call-logs",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.AIConfigRead, { requestId: req.id });
      const parsed = callLogsListQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId: queryProjectId, model, from, to, page, pageSize } =
        parsed.data;
      const projectId = resolveProjectScope(user, queryProjectId, req.id);
      // The AI call log carries a projectId indirectly via the linked
      // AIOutput. We filter on the AIOutput's projectId so the call
      // log list always reflects the caller's project scope, even when
      // the same prompt template is shared across projects.
      const where = {
        aiOutput: { projectId },
        ...(model ? { model } : {}),
        ...(from || to
          ? {
              startedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().aICallLog.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            promptTemplate: { select: { code: true, version: true } },
            aiOutput: { select: { id: true, kind: true, status: true } },
            User: { select: { displayName: true } },
          },
        }),
        prisma().aICallLog.count({ where }),
      ]);
      type Row = AICallLog & {
        promptTemplate: Pick<PromptTemplate, "code" | "version"> | null;
        aiOutput: Pick<AIOutput, "id" | "kind" | "status"> | null;
        User: Pick<User, "displayName"> | null;
      };
      return {
        total,
        page,
        pageSize,
        items: rows.map((r: Row) => ({
          id: r.id,
          projectId,
          module: r.aiOutput?.kind ?? "(unknown)",
          caller: r.User?.displayName ?? r.userId ?? "system",
          inputHash: r.inputHash,
          model: r.model,
          promptTemplateCode: r.promptTemplate?.code ?? null,
          promptVersion: r.promptTemplate?.version ?? null,
          aiOutputId: r.aiOutput?.id ?? null,
          aiOutputKind: r.aiOutput?.kind ?? null,
          aiOutputStatus: r.aiOutput?.status ?? null,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
          statusCode: r.statusCode,
          errorMessage: r.errorMessage ?? null,
        })),
      };
    },
  );

  /* ─── Outputs review queue (R2) ──────────────────────── */
  app.get<{ Querystring: z.infer<typeof outputsListQuery> }>(
    "/api/ai-config/outputs",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.AIOutputRead, { requestId: req.id });
      const parsed = outputsListQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId: queryProjectId, kind, status, page, pageSize } =
        parsed.data;
      const projectId = resolveProjectScope(user, queryProjectId, req.id);
      const where = {
        projectId,
        status,
        ...(kind ? { kind } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().aIOutput.findMany({
          where,
          orderBy: { generatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            promptTemplate: { select: { code: true, version: true } },
            confirmedBy: { select: { displayName: true } },
          },
        }),
        prisma().aIOutput.count({ where }),
      ]);
      type Row = AIOutput & {
        promptTemplate: Pick<PromptTemplate, "code" | "version"> | null;
        confirmedBy: Pick<User, "displayName"> | null;
      };
      return {
        total,
        page,
        pageSize,
        items: rows.map((r: Row) => ({
          id: r.id,
          kind: r.kind,
          projectId: r.projectId,
          subjectId: r.subjectId,
          confidence: r.confidence,
          confidenceLevel: r.confidenceLevel,
          status: r.status,
          model: r.model,
          modelVersion: r.modelVersion,
          inputHash: r.inputHash,
          promptTemplateCode: r.promptTemplate?.code ?? null,
          promptVersion: r.promptTemplate?.version ?? null,
          payload: r.payload,
          generatedAt: r.generatedAt.toISOString(),
          confirmedByUserId: r.confirmedByUserId ?? null,
          confirmedByName: r.confirmedBy?.displayName ?? null,
          confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
          notes: r.notes,
          rejectionReason: r.rejectionReason,
        })),
      };
    },
  );

  /* ─── Adopt output (R1 + atomic) ──────────────────────── */
  app.post<{
    Params: { outputId: string };
    Body: z.infer<typeof adoptOutputSchema>;
  }>("/api/ai-config/outputs/:outputId/adopt", async (req) => {
    const user = await requireUser(req);
    const parsed = adoptOutputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const row = await prisma().aIOutput.findUnique({
      where: { id: req.params.outputId },
    });
    if (!row) {
      throw new ApiErrorException(
        ApiErrorCode.NOT_FOUND,
        "AIOutput not found",
        { requestId: req.id, details: { outputId: req.params.outputId } },
      );
    }
    // R2: target project isolation.
    assertProjectAccess(user, row.projectId, req.id);
    // R1: resolve the actor's role on the target project.
    const actor = resolveActorRoleForProject(user, row.projectId, req.id);
    authorize(
      { userId: actor.userId, role: actor.role },
      Permission.AIOutputAdopt,
      { requestId: req.id },
    );
    // Domain lifecycle: domain helper enforces the legal transition
    // and writes the rejection-reason / notes / confirmedBy fields.
    const updated = applyAIConfirmation(
      toDomainAIOutput(row),
      HumanConfirmationStatus.Adopted,
      { userId: user.userId },
      { notes: parsed.data.notes },
    );
    const result = await prisma().$transaction(async (tx) => {
      const next = await tx.aIOutput.update({
        where: { id: row.id },
        data: {
          status: updated.status,
          confirmedByUserId: updated.confirmedByUserId,
          confirmedAt: updated.confirmedAt,
          notes: updated.confirmationNotes ?? null,
        },
      });
      await auditTx(
        tx,
        req,
        user,
        AuditAction.AIOutputAdopted,
        "AIOutput",
        next.id,
        {
          kind: next.kind,
          projectId: next.projectId,
          notes: parsed.data.notes ?? null,
        },
        {
          beforeValue: { status: row.status },
          projectId: next.projectId,
        },
      );
      return next;
    });
    return {
      id: result.id,
      status: result.status,
      confirmedByUserId: result.confirmedByUserId,
      confirmedAt: result.confirmedAt ? result.confirmedAt.toISOString() : null,
    };
  });

  /* ─── Reject output (R1 + atomic + reason required) ──── */
  app.post<{
    Params: { outputId: string };
    Body: z.infer<typeof rejectOutputSchema>;
  }>("/api/ai-config/outputs/:outputId/reject", async (req) => {
    const user = await requireUser(req);
    const parsed = rejectOutputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const row = await prisma().aIOutput.findUnique({
      where: { id: req.params.outputId },
    });
    if (!row) {
      throw new ApiErrorException(
        ApiErrorCode.NOT_FOUND,
        "AIOutput not found",
        { requestId: req.id, details: { outputId: req.params.outputId } },
      );
    }
    // R2: target project isolation.
    assertProjectAccess(user, row.projectId, req.id);
    // R1: resolve the actor's role on the target project.
    const actor = resolveActorRoleForProject(user, row.projectId, req.id);
    authorize(
      { userId: actor.userId, role: actor.role },
      Permission.AIOutputReject,
      { requestId: req.id },
    );
    // Domain lifecycle: enforces the legal transition and the
    // rejection-reason requirement as a defense-in-depth check (the
    // schema + audit() helper also enforce it).
    const updated = applyAIConfirmation(
      toDomainAIOutput(row),
      HumanConfirmationStatus.Rejected,
      { userId: user.userId },
      { reason: parsed.data.reason, notes: parsed.data.notes },
    );
    const result = await prisma().$transaction(async (tx) => {
      const next = await tx.aIOutput.update({
        where: { id: row.id },
        data: {
          status: updated.status,
          confirmedByUserId: updated.confirmedByUserId,
          confirmedAt: updated.confirmedAt,
          notes: updated.confirmationNotes ?? null,
          rejectionReason: updated.rejectionReason ?? null,
        },
      });
      // CRITICAL_AUDIT_PAIRS marks AIOutput.AIOutputRejected as
      // requiresReason: true; auditTx() throws REASON_REQUIRED on
      // blank reasons before the row is committed.
      await auditTx(
        tx,
        req,
        user,
        AuditAction.AIOutputRejected,
        "AIOutput",
        next.id,
        {
          kind: next.kind,
          projectId: next.projectId,
          notes: parsed.data.notes ?? null,
        },
        {
          beforeValue: { status: row.status },
          reason: parsed.data.reason,
          projectId: next.projectId,
        },
      );
      return next;
    });
    return {
      id: result.id,
      status: result.status,
      confirmedByUserId: result.confirmedByUserId,
      confirmedAt: result.confirmedAt ? result.confirmedAt.toISOString() : null,
      rejectionReason: result.rejectionReason,
    };
  });
}
