/**
 * Risk signal API client. Mirrors the Fastify routes mounted at /api/risks.
 *
 * The workbench UI subscribes to the same JSON shape the API returns;
 * types here are kept narrow to match the route response exactly.
 */
import { apiGet, apiPost } from "./client.js";

export type RiskLevelValue = "Low" | "Medium" | "High" | "Critical";
export type RiskStatusValue =
  | "Open"
  | "Assigned"
  | "InProgress"
  | "PendingInvestigator"
  | "Resolved"
  | "Closed"
  | "Rejected";

export interface RiskListRow {
  id: string;
  level: RiskLevelValue;
  type: string;
  objectType: string;
  objectId: string;
  subjectCode: string | null;
  trigger: string;
  suggestion: string | null;
  ownerUserId: string | null;
  owner: string | null;
  deadline: string | null;
  status: RiskStatusValue;
  aiOutputId: string | null;
  handlingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: RiskListRow[];
}

export interface RiskHandlingRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: "assign" | "resolve" | "close" | "reject";
  fromStatus: RiskStatusValue;
  toStatus: RiskStatusValue;
  reason: string | null;
  at: string;
}

export interface RiskAuditRow {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  timestamp: string;
}

export interface RiskAIOutput {
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

export interface RiskDetailResponse {
  risk: Omit<RiskListRow, "handlingCount"> & {
    projectId: string;
    subjectId: string | null;
  };
  aiOutput: RiskAIOutput | null;
  handling: RiskHandlingRow[];
  auditTrail: RiskAuditRow[];
}

export interface ListRiskParams {
  level?: RiskLevelValue;
  status?: RiskStatusValue;
  type?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export async function listRisks(
  params: ListRiskParams = {},
): Promise<RiskListResponse> {
  const qs = new URLSearchParams();
  if (params.level) qs.set("level", params.level);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.ownerId) qs.set("ownerId", params.ownerId);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<RiskListResponse>(`/api/risks${suffix}`);
}

export async function getRisk(id: string): Promise<RiskDetailResponse> {
  return apiGet<RiskDetailResponse>(`/api/risks/${id}`);
}

export async function assignRisk(
  id: string,
  ownerUserId: string,
): Promise<{ id: string; status: RiskStatusValue; ownerUserId: string | null }> {
  return apiPost(`/api/risks/${id}/assign`, { ownerUserId });
}

export async function resolveRisk(
  id: string,
  reason?: string,
): Promise<{ id: string; status: RiskStatusValue }> {
  return apiPost(`/api/risks/${id}/resolve`, { reason });
}

export async function closeRisk(
  id: string,
  reason: string,
): Promise<{ id: string; status: RiskStatusValue }> {
  return apiPost(`/api/risks/${id}/close`, { reason });
}

export async function rejectRisk(
  id: string,
  reason: string,
): Promise<{ id: string; status: RiskStatusValue }> {
  return apiPost(`/api/risks/${id}/reject`, { reason });
}
