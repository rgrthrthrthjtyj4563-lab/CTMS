/**
 * Report Center API client. Mirrors the Fastify routes mounted at
 * /api/reports.
 *
 * The Reports page subscribes to the same JSON shape the API returns;
 * types here are kept narrow to match the route response exactly.
 */
import { apiGet, apiPost } from "./client.js";

export type ReportStatusValue =
  | "Generating"
  | "Draft"
  | "UnderReview"
  | "Confirmed"
  | "Exported"
  | "Failed";

export type ReportTypeValue = "Interim" | "Final" | "Safety" | "Custom";

export type ReportFormatValue = "CSV" | "PDF" | "XLSX" | "JSON";

export interface ReportListRow {
  id: string;
  projectId: string;
  type: ReportTypeValue | string;
  status: ReportStatusValue;
  sourceSnapshotId: string | null;
  generatedAt: string;
  confirmedAt: string | null;
  exportedAt: string | null;
}

export interface ReportListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ReportListRow[];
}

export interface ReportAIOutput {
  id: string;
  kind: string;
  confidence: number;
  confidenceLevel: string | null;
  status: string;
  model: string | null;
  modelVersion: string | null;
  payload: unknown;
  generatedAt: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  notes: string | null;
}

export interface ReportExportRecord {
  id: string;
  projectId: string;
  objectType: string;
  objectIds: string[];
  format: string;
  reason: string;
  exportedByUserId: string;
  exportedAt: string;
}

export interface ReportAuditRow {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  timestamp: string;
}

export interface ReportDetailResponse {
  report: ReportListRow;
  aiOutput: ReportAIOutput | null;
  exportRecord: ReportExportRecord | null;
  auditTrail: ReportAuditRow[];
}

export interface ListReportParams {
  status?: ReportStatusValue;
  type?: ReportTypeValue;
  page?: number;
  pageSize?: number;
}

export async function listReports(
  params: ListReportParams = {},
): Promise<ReportListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<ReportListResponse>(`/api/reports${suffix}`);
}

export async function getReport(id: string): Promise<ReportDetailResponse> {
  return apiGet<ReportDetailResponse>(`/api/reports/${id}`);
}

export async function generateReport(
  body: { type?: ReportTypeValue; notes?: string } = {},
): Promise<{
  id: string;
  projectId: string;
  type: ReportTypeValue | string;
  status: ReportStatusValue;
  generatedAt: string;
}> {
  return apiPost("/api/reports", body);
}

export async function confirmReport(
  id: string,
): Promise<{ id: string; status: ReportStatusValue; confirmedAt: string | null }> {
  return apiPost(`/api/reports/${id}/confirm`, {});
}

export async function exportReport(
  id: string,
  reason: string,
  format: ReportFormatValue = "PDF",
): Promise<{
  id: string;
  status: ReportStatusValue;
  exportedAt: string | null;
  exportRecordId: string;
}> {
  return apiPost(`/api/reports/${id}/export`, { reason, format });
}
