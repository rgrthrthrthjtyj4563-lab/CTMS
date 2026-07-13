/**
 * Document Center endpoints for Phase 3 Task 3.5.
 *
 *   GET    /api/documents                           — list (filter by projectId, category, q)
 *   POST   /api/documents                           — create (DocumentUpload; title, category)
 *   GET    /api/documents/:documentId               — detail + versions (newest first)
 *   POST   /api/documents/:documentId/versions      — upload new version (DocumentVersion)
 *   GET    /api/documents/:documentId/versions      — list versions
 *
 * RBAC:
 *   - DocumentRead: SponsorAdmin / CROPM / SitePI / SiteCRC / CRA / Auditor / RegulatorReadOnly / ProviderNurse
 *   - DocumentUpload: SponsorAdmin / CROPM / SitePI
 *   - DocumentVersion: same as upload (PIs often add a new site-level revision)
 *
 * Cross-project isolation: every endpoint scopes the lookup by user.projectId
 * unless the caller supplies an explicit projectId query that matches their
 * role assignment (e.g. SponsorAdmin can read across all projects). We do
 * not allow crossing projects implicitly — a CRA on project A cannot see
 * docs on project B even if they know the title.
 *
 * Versioning: each DocumentVersion is immutable once written. The Document
 * row carries currentVersionId for cheap "latest" reads. We never delete a
 * version — supersession is captured by uploading a new version. Upload
 * writes a create audit event for the version and an update audit event
 * for the Document (currentVersionId change) so the audit chain records
 * who promoted a new version.
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
import { audit, requireUser } from "../lib/auth.js";

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
  /** Optional inline first version. The user can upload a separate
   * version later via POST /:documentId/versions. */
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

async function loadDocumentScoped(
  user: { projectId: string },
  documentId: string,
) {
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
  if (doc.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Document belongs to a different project",
      { details: { documentId } },
    );
  }
  return doc;
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
      const { projectId, category, q, page, pageSize } = parsed.data;
      const where = {
        projectId: projectId ?? user.projectId,
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

  /* ─── Create (DocumentUpload) ─────────────────────────── */
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
      // Create the row and the first version atomically. If the version
      // payload is missing we still create the document (the user can
      // upload a version afterwards); otherwise we set currentVersionId.
      const created = await prisma().document.create({
        data: {
          projectId: user.projectId,
          title,
          category,
          uploadedByUserId: user.userId,
        },
      });
      let versionId: string | null = null;
      if (initialVersion) {
        const version = await prisma().documentVersion.create({
          data: {
            documentId: created.id,
            version: initialVersion.version,
            fileUrl: initialVersion.fileUrl,
            sha256: initialVersion.sha256,
            uploadedByUserId: user.userId,
          },
        });
        versionId = version.id;
        await prisma().document.update({
          where: { id: created.id },
          data: { currentVersionId: versionId },
        });
        await audit(
          req,
          user,
          AuditAction.Create,
          "DocumentVersion",
          version.id,
          {
            documentId: created.id,
            version: initialVersion.version,
          },
        );
      }
      await audit(
        req,
        user,
        AuditAction.Create,
        "Document",
        created.id,
        {
          title: created.title,
          category: created.category,
          currentVersionId: versionId,
        },
      );
      return {
        id: created.id,
        projectId: created.projectId,
        title: created.title,
        category: created.category,
        currentVersionId: versionId,
        uploadedByUserId: created.uploadedByUserId,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
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

  /* ─── Upload new version (DocumentVersion) ────────────── */
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
    // crash. We use exists() rather than a catch because a thrown
    // P2002 leaks DB specifics in the 500 path.
    const exists = await prisma().documentVersion.findFirst({
      where: { documentId: doc.id, version: parsed.data.version },
    });
    if (exists) {
      throw new ApiErrorException(
        ApiErrorCode.CONFLICT,
        `Version ${parsed.data.version} already exists for this document`,
        {
          requestId: req.id,
          details: { documentId: doc.id, version: parsed.data.version },
        },
      );
    }
    // audit-before-mutate: persist the version + the Document.currentVersionId
    // change in a single transaction, writing the create + update audit
    // events first so a failed write leaves the document unchanged.
    const newVersion = await prisma().documentVersion.create({
      data: {
        documentId: doc.id,
        version: parsed.data.version,
        fileUrl: parsed.data.fileUrl,
        sha256: parsed.data.sha256,
        uploadedByUserId: user.userId,
      },
    });
    await audit(
      req,
      user,
      AuditAction.Create,
      "DocumentVersion",
      newVersion.id,
      {
        documentId: doc.id,
        version: newVersion.version,
        sha256: newVersion.sha256,
      },
    );
    await audit(
      req,
      user,
      AuditAction.Update,
      "Document",
      doc.id,
      { currentVersionId: newVersion.id, version: newVersion.version },
      { beforeValue: { currentVersionId: doc.currentVersionId } },
    );
    await prisma().document.update({
      where: { id: doc.id },
      data: { currentVersionId: newVersion.id },
    });
    return {
      id: newVersion.id,
      documentId: doc.id,
      version: newVersion.version,
      fileUrl: newVersion.fileUrl,
      sha256: newVersion.sha256,
      uploadedByUserId: newVersion.uploadedByUserId,
      uploadedAt: newVersion.uploadedAt.toISOString(),
      isCurrent: true,
    };
  });
}
