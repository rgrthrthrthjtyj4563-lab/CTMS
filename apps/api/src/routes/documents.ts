/**
 * Document Center endpoints for Phase 3 Task 3.5 (post-review).
 *
 *   GET    /api/documents                           — list (DocumentRead)
 *   POST   /api/documents                           — create (DocumentUpload)
 *   GET    /api/documents/:documentId               — detail + versions + audit chain
 *   POST   /api/documents/:documentId/versions      — upload new version (DocumentVersion)
 *   GET    /api/documents/:documentId/versions      — list versions
 *
 * Audit/taxonomy (architect review fix C2/M3):
 *   Version events use `objectType: Document` (single canonical type
 *   per the audit taxonomy). The version-specific payload lives in
 *   `afterValue` as `{ kind: "version", versionId, version, sha256,
 *   fileUrl, uploadedByUserId, uploadedAt }`. The detail endpoint
 *   merges Document audit events with version-tagged events so the
 *   Drawer shows the full chain including every uploaded version.
 *
 * Cross-project isolation (architect review fix C1):
 *   - List endpoints accept `?projectId=` but only honor it when the
 *     caller holds a role assignment on that project (resolved via
 *     `resolveProjectScope`).
 *   - Detail / mutate endpoints call `assertProjectAccess` against
 *     the document's own projectId.
 *
 * Atomicity (architect review fix M1/M4):
 *   - `POST /api/documents` and `POST /api/documents/:id/versions`
 *     wrap data writes AND audit writes in a single
 *     `prisma.$transaction([...])` so the audit chain and the data
 *     state never diverge.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  AuditAction,
  Permission,
  authorize,
} from "@aic-dct/domain";
import type { Document, DocumentVersion } from "@prisma/client";
import { prisma } from "../db.js";
import {
  assertProjectAccess,
  auditTx,
  requireUser,
  resolveProjectScope,
  type AuthenticatedUser,
} from "../lib/auth.js";

const DOCUMENT_CATEGORIES = [
  "Protocol",
  "ICF",
  "Manual",
  "EthicsApproval",
  "VisitForm",
  "SAEReport",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  q: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES).default("Other"),
  initialVersion: z
    .object({
      fileUrl: z.string().min(1).max(2000),
      sha256: z.string().regex(/^[a-f0-9]{64}$/, "sha256 must be 64 hex chars"),
      version: z.string().min(1).max(40).default("v1"),
    })
    .optional(),
});

const versionSchema = z.object({
  version: z.string().min(1).max(40),
  fileUrl: z.string().min(1).max(2000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "sha256 must be 64 hex chars"),
});

async function loadDocumentScoped(user: AuthenticatedUser, documentId: string) {
  const doc = await prisma().document.findUnique({
    where: { id: documentId },
  });
  if (!doc) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Document not found",
      { details: { documentId } },
    );
  }
  // C1: cross-project isolation enforced against the document's own
  // projectId. The helper throws 403 if the caller has no role
  // assignment on doc.projectId.
  assertProjectAccess(user, doc.projectId, reqIdForLoad());
  return doc;
}

// The detail/upload helpers carry the Fastify request id; the load
// helper runs against a request-bound user. We thread a synthetic
// requestId string here so assertProjectAccess can be called without
// a FastifyRequest object — the id is only used for log correlation.
function reqIdForLoad(): string {
  return "document-load";
}

export function registerDocumentRoutes(app: FastifyInstance): void {
  /* ─── List ────────────────────────────────────────────── */
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/documents",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.DocumentRead, { requestId: req.id });
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId: queryProjectId, category, q, page, pageSize } = parsed.data;
      // C1: scope to the caller's project unless they have a real
      // assignment on a different one. The previous implementation
      // honored any ?projectId= query, which leaked documents across
      // projects to any role with DocumentRead.
      const projectId = resolveProjectScope(user, queryProjectId, req.id);
      const where = {
        projectId,
        ...(category ? { category } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().document.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().document.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((r: Document) => ({
          id: r.id,
          projectId: r.projectId,
          title: r.title,
          category: r.category,
          currentVersionId: r.currentVersionId ?? null,
          uploadedByUserId: r.uploadedByUserId ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  /* ─── Detail ──────────────────────────────────────────── */
  app.get<{ Params: { documentId: string } }>(
    "/api/documents/:documentId",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.DocumentRead, { requestId: req.id });
      const doc = await loadDocumentScoped(user, req.params.documentId);
      const [versions, auditTrail] = await Promise.all([
        prisma().documentVersion.findMany({
          where: { documentId: doc.id },
          orderBy: { uploadedAt: "desc" },
        }),
        // M3: include all Document-objectType events for this id. The
        // version events share objectId=doc.id and carry an
        // afterValue.kind === "version" tag, so they merge naturally
        // into the audit chain returned to the client.
        prisma().auditEvent.findMany({
          where: { objectType: "Document", objectId: doc.id },
          orderBy: { timestamp: "desc" },
        }),
      ]);
      return {
        document: {
          id: doc.id,
          projectId: doc.projectId,
          title: doc.title,
          category: doc.category,
          currentVersionId: doc.currentVersionId ?? null,
          uploadedByUserId: doc.uploadedByUserId ?? null,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        },
        versions: versions.map((v: DocumentVersion) => ({
          id: v.id,
          version: v.version,
          fileUrl: v.fileUrl,
          sha256: v.sha256,
          uploadedByUserId: v.uploadedByUserId,
          uploadedAt: v.uploadedAt.toISOString(),
          isCurrent: v.id === doc.currentVersionId,
        })),
        auditTrail: auditTrail.map((a) => ({
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

  /* ─── Create (DocumentUpload) — atomic with version + audit ── */
  app.post<{ Body: z.infer<typeof createSchema> }>(
    "/api/documents",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.DocumentUpload, { requestId: req.id });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { title, category, initialVersion } = parsed.data;
      const projectId = user.projectId;

      // M4: create-document + (optional) initial version + audit event
      // are wrapped in a single $transaction. If any step throws the
      // whole batch rolls back, so a half-built document can never
      // exist in the DB.
      if (initialVersion) {
        const result = await prisma().$transaction(async (tx) => {
          const created = await tx.document.create({
            data: {
              projectId,
              title,
              category,
              uploadedByUserId: user.userId,
            },
          });
          const version = await tx.documentVersion.create({
            data: {
              documentId: created.id,
              version: initialVersion.version,
              fileUrl: initialVersion.fileUrl,
              sha256: initialVersion.sha256,
              uploadedByUserId: user.userId,
            },
          });
          await tx.document.update({
            where: { id: created.id },
            data: { currentVersionId: version.id },
          });
          // C2: the version event uses objectType=Document; the payload
          // tag makes it filterable on the detail page.
          await auditTx(
            tx,
            req,
            user,
            AuditAction.Create,
            "Document",
            created.id,
            {
              kind: "version",
              versionId: version.id,
              version: initialVersion.version,
              sha256: initialVersion.sha256,
              fileUrl: initialVersion.fileUrl,
              uploadedByUserId: user.userId,
            },
            { projectId },
          );
          return { created, version };
        });
        return {
          id: result.created.id,
          projectId: result.created.projectId,
          title: result.created.title,
          category: result.created.category,
          currentVersionId: result.version.id,
          uploadedByUserId: result.created.uploadedByUserId,
          createdAt: result.created.createdAt.toISOString(),
          updatedAt: result.created.updatedAt.toISOString(),
        };
      }

      // No initial version: still atomic for the audit chain.
      const result = await prisma().$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            projectId,
            title,
            category,
            uploadedByUserId: user.userId,
          },
        });
        await auditTx(
          tx,
          req,
          user,
          AuditAction.Create,
          "Document",
          created.id,
          { title: created.title, category: created.category, currentVersionId: null },
          { projectId },
        );
        return created;
      });
      return {
        id: result.id,
        projectId: result.projectId,
        title: result.title,
        category: result.category,
        currentVersionId: null,
        uploadedByUserId: result.uploadedByUserId,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    },
  );

  /* ─── List versions ───────────────────────────────────── */
  app.get<{ Params: { documentId: string } }>(
    "/api/documents/:documentId/versions",
    async (req) => {
      const user = await requireUser(req);
      authorize(user, Permission.DocumentRead, { requestId: req.id });
      const doc = await loadDocumentScoped(user, req.params.documentId);
      const versions = await prisma().documentVersion.findMany({
        where: { documentId: doc.id },
        orderBy: { uploadedAt: "desc" },
      });
      return {
        documentId: doc.id,
        currentVersionId: doc.currentVersionId ?? null,
        versions: versions.map((v: DocumentVersion) => ({
          id: v.id,
          version: v.version,
          fileUrl: v.fileUrl,
          sha256: v.sha256,
          uploadedByUserId: v.uploadedByUserId,
          uploadedAt: v.uploadedAt.toISOString(),
          isCurrent: v.id === doc.currentVersionId,
        })),
      };
    },
  );

  /* ─── Upload new version (DocumentVersion) — atomic ──── */
  app.post<{
    Params: { documentId: string };
    Body: z.infer<typeof versionSchema>;
  }>("/api/documents/:documentId/versions", async (req) => {
    const user = await requireUser(req);
    authorize(user, Permission.DocumentVersion, { requestId: req.id });
    const doc = await loadDocumentScoped(user, req.params.documentId);
    const parsed = versionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    // Reject duplicate (documentId, version) tuples up-front so the
    // caller gets a clean 409 instead of a Prisma unique-constraint
    // crash leaking DB specifics.
    const existing = await prisma().documentVersion.findFirst({
      where: { documentId: doc.id, version: parsed.data.version },
    });
    if (existing) {
      throw new ApiErrorException(
        ApiErrorCode.CONFLICT,
        `Version ${parsed.data.version} already exists for this document`,
        {
          requestId: req.id,
          details: { documentId: doc.id, version: parsed.data.version },
        },
      );
    }
    // M1: version create + Document.update + 2 audit events wrapped in
    // a single $transaction. If the tx throws, no version is
    // persisted and no audit events are written, so the audit chain
    // and the data state never diverge.
    const result = await prisma().$transaction(async (tx) => {
      const newVersion = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: parsed.data.version,
          fileUrl: parsed.data.fileUrl,
          sha256: parsed.data.sha256,
          uploadedByUserId: user.userId,
        },
      });
      await tx.document.update({
        where: { id: doc.id },
        data: { currentVersionId: newVersion.id },
      });
      // C2: version event uses objectType=Document; payload is tagged
      // so the detail page can distinguish "create version" from
      // "update currentVersionId".
      await auditTx(
        tx,
        req,
        user,
        AuditAction.Create,
        "Document",
        doc.id,
        {
          kind: "version",
          versionId: newVersion.id,
          version: newVersion.version,
          sha256: newVersion.sha256,
          fileUrl: newVersion.fileUrl,
          uploadedByUserId: user.userId,
        },
        { projectId: doc.projectId },
      );
      await auditTx(
        tx,
        req,
        user,
        AuditAction.Update,
        "Document",
        doc.id,
        {
          kind: "currentVersion",
          currentVersionId: newVersion.id,
          version: newVersion.version,
        },
        {
          beforeValue: { currentVersionId: doc.currentVersionId },
          projectId: doc.projectId,
        },
      );
      return newVersion;
    });
    return {
      id: result.id,
      documentId: doc.id,
      version: result.version,
      fileUrl: result.fileUrl,
      sha256: result.sha256,
      uploadedByUserId: result.uploadedByUserId,
      uploadedAt: result.uploadedAt.toISOString(),
      isCurrent: true,
    };
  });
}
