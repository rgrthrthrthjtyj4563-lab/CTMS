/**
 * Audit API client. Mirrors the Fastify routes mounted at /api/audit.
 */
import { apiGet, apiPost } from "./client.js";

export type AuditFormat = "CSV" | "PDF" | "XLSX" | "JSON";

export interface AuditEvent {
  id: string;
  actorUserId: string;
  actorRole: string;
  projectId: string;
  objectType: string;
  objectId: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  requestId: string | null;
  timestamp: string;
}

export interface AuditEventListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AuditEvent[];
}

export interface AuditExportRecord {
  id: string;
  projectId: string;
  objectType: string;
  format: string;
  reason: string;
  exportedByUserId: string;
  exportedAt: string;
}

export interface AuditExportListResponse {
  items: AuditExportRecord[];
}

export interface ListAuditEventsParams {
  projectId?: string;
  objectType?: string;
  action?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditEvents(
  params: ListAuditEventsParams = {},
): Promise<AuditEventListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<AuditEventListResponse>(`/api/audit/events${suffix}`);
}

export async function listAuditExports(): Promise<AuditExportListResponse> {
  return apiGet<AuditExportListResponse>("/api/audit/exports");
}

export async function createAuditExport(body: {
  reason: string;
  format: AuditFormat;
  filters: {
    projectId?: string;
    objectType?: string;
    action?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
  };
}): Promise<AuditExportRecord> {
  return apiPost("/api/audit/exports", body);
}
