/**
 * Safety event API client. Mirrors the Fastify routes mounted at
 * /api/safety. All requests go through the auth-aware client so
 * X-Actor-Id / X-Actor-Role headers are attached automatically.
 */
import { apiGet, apiPost } from "./client.js";

export interface SafetyEventListRow {
  id: string;
  subjectId: string;
  subjectCode: string;
  onsetAt: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  isSerious: boolean;
  status: SafetyEventStatusValue;
  aiSuggested: boolean;
  followUpCount: number;
  createdBy: string | null;
  createdAt: string;
}

export type SafetyEventStatusValue =
  | "Draft"
  | "InvestigatorReview"
  | "ConfirmedAE"
  | "ConfirmedSAE"
  | "Reported"
  | "FollowUp"
  | "Closed";

export interface SafetyEventListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: SafetyEventListRow[];
}

export interface SafetyFollowUpRow {
  id: string;
  followUpAt: string;
  outcome: string;
  recordedBy: string;
  createdAt: string;
}

export interface SafetyEventDetail {
  event: {
    id: string;
    subjectId: string;
    subjectCode: string;
    projectId: string;
    onsetAt: string;
    description: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    isSerious: boolean;
    aiSuggested: boolean;
    status: SafetyEventStatusValue;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  followUps: SafetyFollowUpRow[];
  auditTrail: Array<{
    id: string;
    actorUserId: string;
    actorRole: string;
    action: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string | null;
    timestamp: string;
  }>;
}

export async function listSafetyEvents(params: {
  subjectId?: string;
  status?: SafetyEventStatusValue;
  severity?: "Low" | "Medium" | "High" | "Critical";
  page?: number;
  pageSize?: number;
} = {}): Promise<SafetyEventListResponse> {
  const qs = new URLSearchParams();
  if (params.subjectId) qs.set("subjectId", params.subjectId);
  if (params.status) qs.set("status", params.status);
  if (params.severity) qs.set("severity", params.severity);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<SafetyEventListResponse>(`/api/safety/events${suffix}`);
}

export async function getSafetyEvent(id: string): Promise<SafetyEventDetail> {
  return apiGet<SafetyEventDetail>(`/api/safety/events/${id}`);
}

export async function createSafetyEvent(body: {
  subjectId: string;
  onsetAt: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  isSerious?: boolean;
}): Promise<{ id: string; status: SafetyEventStatusValue }> {
  return apiPost<{ id: string; status: SafetyEventStatusValue }>(
    "/api/safety/events",
    body,
  );
}

export async function confirmSafetyEvent(
  id: string,
  outcome: "ConfirmedAE" | "ConfirmedSAE",
  isSerious?: boolean,
): Promise<{ id: string; status: SafetyEventStatusValue; isSerious: boolean }> {
  return apiPost<{
    id: string;
    status: SafetyEventStatusValue;
    isSerious: boolean;
  }>(`/api/safety/events/${id}/confirm`, { outcome, isSerious });
}

export async function reportSafetyEvent(
  id: string,
  reason: string,
  regulator?: string,
): Promise<{ id: string; status: SafetyEventStatusValue }> {
  return apiPost<{ id: string; status: SafetyEventStatusValue }>(
    `/api/safety/events/${id}/report`,
    { reason, regulator },
  );
}

export async function recordSafetyFollowUp(
  id: string,
  outcome: string,
  followUpAt?: string,
): Promise<{
  id: string;
  followUpAt: string;
  outcome: string;
  status: SafetyEventStatusValue;
}> {
  return apiPost<{
    id: string;
    followUpAt: string;
    outcome: string;
    status: SafetyEventStatusValue;
  }>(`/api/safety/events/${id}/follow-up`, { outcome, followUpAt });
}

export async function closeSafetyEvent(
  id: string,
  reason: string,
): Promise<{ id: string; status: SafetyEventStatusValue }> {
  return apiPost<{ id: string; status: SafetyEventStatusValue }>(
    `/api/safety/events/${id}/close`,
    { reason },
  );
}
