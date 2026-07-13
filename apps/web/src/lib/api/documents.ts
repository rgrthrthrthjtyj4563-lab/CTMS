/**
 * Document Center API client. Mirrors the Fastify routes mounted at
 * /api/documents.
 */
import { apiGet, apiPost } from "./client.js";

export type DocumentCategory =
  | "Protocol"
  | "ICF"
  | "Manual"
  | "EthicsApproval"
  | "VisitForm"
  | "SAEReport"
  | "Other";

export interface DocumentListRow {
  id: string;
  projectId: string;
  title: string;
  category: DocumentCategory | string;
  currentVersionId: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: DocumentListRow[];
}

export interface DocumentVersion {
  id: string;
  version: string;
  fileUrl: string;
  sha256: string;
  uploadedByUserId: string;
  uploadedAt: string;
  isCurrent: boolean;
}

export interface DocumentAuditRow {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  timestamp: string;
}

export interface DocumentDetailResponse {
  document: DocumentListRow;
  versions: DocumentVersion[];
  auditTrail: DocumentAuditRow[];
}

export interface DocumentVersionsResponse {
  documentId: string;
  currentVersionId: string | null;
  versions: DocumentVersion[];
}

export interface ListDocumentParams {
  category?: DocumentCategory;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listDocuments(
  params: ListDocumentParams = {},
): Promise<DocumentListResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<DocumentListResponse>(`/api/documents${suffix}`);
}

export async function getDocument(
  id: string,
): Promise<DocumentDetailResponse> {
  return apiGet<DocumentDetailResponse>(`/api/documents/${id}`);
}

export async function listDocumentVersions(
  id: string,
): Promise<DocumentVersionsResponse> {
  return apiGet<DocumentVersionsResponse>(`/api/documents/${id}/versions`);
}

export async function createDocument(body: {
  title: string;
  category: DocumentCategory;
  initialVersion?: {
    version?: string;
    fileUrl: string;
    sha256: string;
  };
}): Promise<DocumentListRow> {
  return apiPost("/api/documents", body);
}

export async function uploadDocumentVersion(
  id: string,
  body: { version: string; fileUrl: string; sha256: string },
): Promise<DocumentVersion> {
  return apiPost(`/api/documents/${id}/versions`, body);
}
