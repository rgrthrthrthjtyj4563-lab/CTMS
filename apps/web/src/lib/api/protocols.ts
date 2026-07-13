/**
 * Protocol API client. Mirrors the Fastify routes mounted at
 * /api/protocol/versions (apps/api/src/routes/protocol.ts).
 *
 * The workbench UI subscribes to the same JSON shape the API returns;
 * types here are kept narrow to match the route response exactly.
 */
import { apiGet, apiPost } from "./client.js";

export type ProtocolParseStatusValue =
  | "Uploaded"
  | "Parsing"
  | "Parsed"
  | "ParseFailed"
  | "UnderReview"
  | "Effective"
  | "Superseded";

export interface ProtocolVersionRow {
  id: string;
  projectId: string;
  version: string;
  documentUrl: string;
  parseStatus: ProtocolParseStatusValue;
  effectiveFrom: string | null;
  supersededAt: string | null;
  uploadedAt: string;
}

export interface ProtocolVersionListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ProtocolVersionRow[];
}

export interface ProtocolAIOutput {
  id: string;
  kind: string;
  confidence: number;
  confidenceLevel: string;
  status: string;
  model: string;
  modelVersion: string;
  payload: unknown;
  generatedAt: string;
}

export interface ProtocolParseResultRow {
  id: string;
  status: string;
  fields: {
    summary?: string;
    eligibility?: string[];
    visits?: Array<{ code: string; label: string; dayOffset: number }>;
    safetyPoints?: string[];
    fieldConfidence?: Record<string, number>;
  };
  confidence: number;
  generatedAt: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  notes: string | null;
  aiOutputId: string | null;
  aiOutput: ProtocolAIOutput | null;
}

export interface ProtocolAuditRow {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  timestamp: string;
}

export interface ProtocolVersionDetailResponse {
  version: ProtocolVersionRow;
  parseResults: ProtocolParseResultRow[];
  auditTrail: ProtocolAuditRow[];
}

export interface ListProtocolParams {
  parseStatus?: ProtocolParseStatusValue;
  page?: number;
  pageSize?: number;
}

export async function listProtocolVersions(
  params: ListProtocolParams = {},
): Promise<ProtocolVersionListResponse> {
  const qs = new URLSearchParams();
  if (params.parseStatus) qs.set("parseStatus", params.parseStatus);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<ProtocolVersionListResponse>(`/api/protocol/versions${suffix}`);
}

export async function getProtocolVersion(
  id: string,
): Promise<ProtocolVersionDetailResponse> {
  return apiGet<ProtocolVersionDetailResponse>(`/api/protocol/versions/${id}`);
}

export async function uploadProtocolVersion(payload: {
  projectId: string;
  version: string;
  documentUrl: string;
}): Promise<ProtocolVersionRow> {
  return apiPost<ProtocolVersionRow>(`/api/protocol/versions`, payload);
}

export async function triggerProtocolParse(
  id: string,
): Promise<{ id: string; parseStatus: ProtocolParseStatusValue }> {
  return apiPost(`/api/protocol/versions/${id}/parse`, {});
}

export async function activateProtocolVersion(
  id: string,
  reason: string,
): Promise<{
  id: string;
  parseStatus: ProtocolParseStatusValue;
  effectiveFrom: string | null;
  supersededPriorId: string | null;
}> {
  return apiPost(`/api/protocol/versions/${id}/activate`, { reason });
}