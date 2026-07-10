/**
 * Consent API client. Mirrors /api/consent.
 */
import { apiGet, apiPost } from "./client.js";

export interface ConsentListRow {
  id: string;
  subjectId: string;
  subjectCode: string;
  documentTitle: string;
  documentVersion: string;
  documentUrl: string;
  status: string;
  comprehensionScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  signatureCount: number;
}

export interface ConsentListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ConsentListRow[];
}

export interface ConsentTaskDetail {
  task: {
    id: string;
    subjectId: string;
    subjectCode: string;
    status: string;
    comprehensionScore: number | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  };
  document: {
    id: string;
    title: string;
    version: string;
    documentUrl: string;
    effectiveFrom: string;
  };
  signatures: Array<{
    id: string;
    signerRole: string;
    signerUserId: string;
    signedAt: string;
    method: string;
    ipAddress: string | null;
  }>;
}

export async function listConsentTasks(params: {
  status?: string;
  subjectId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ConsentListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.subjectId) qs.set("subjectId", params.subjectId);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<ConsentListResponse>(`/api/consent${suffix}`);
}

export async function getConsentTask(id: string): Promise<ConsentTaskDetail> {
  return apiGet<ConsentTaskDetail>(`/api/consent/${id}`);
}

export async function startConsent(id: string) {
  return apiPost<{ id: string; status: string }>(`/api/consent/${id}/start`, {});
}

export async function submitComprehension(
  id: string,
  score: number,
  totalQuestions: number,
) {
  return apiPost<{ id: string; status: string; passed: boolean; percent: number }>(
    `/api/consent/${id}/comprehension`,
    { score, totalQuestions },
  );
}

export async function signConsent(
  id: string,
  signerRole: "Subject" | "Investigator" | "Witness",
  signatureMethod: "ESign" | "WetInk" | "Biometric",
  signaturePayload: string,
) {
  return apiPost<{ id: string; status: string }>(`/api/consent/${id}/sign`, {
    signerRole,
    signatureMethod,
    signaturePayload,
  });
}

export async function withdrawConsent(id: string, reason: string) {
  return apiPost<{ id: string; status: string }>(`/api/consent/${id}/withdraw`, {
    reason,
  });
}
