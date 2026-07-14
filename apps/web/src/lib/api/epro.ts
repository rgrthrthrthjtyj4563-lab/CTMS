/**
 * ePRO API client. Mirrors /api/epro.
 */
import { apiGet, apiPatch, apiPost } from "./client.js";

export interface EproTemplate {
  id: string;
  code: string;
  name: string;
  version: string;
  itemCount: number;
}

export interface EproResponseRow {
  id: string;
  subjectId: string;
  subjectCode: string;
  templateName: string;
  templateVersion: string;
  templateCode: string;
  status: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  entryChannel?: string;
  updatedAt: string;
}

export interface EproListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: EproResponseRow[];
}

export interface QuestionnaireItem {
  id: string;
  type: "scale" | "single" | "multi" | "text" | "number";
  prompt: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  items: QuestionnaireItem[];
}

export interface AssistedEntryMeta {
  id: string;
  reason: string;
  collectionChannel: string;
  recordedAt: string;
  recorder: { id: string; displayName: string } | null;
  dataOrigin: string;
  corrections: Array<{
    id: string;
    reason: string;
    actorName: string;
    correctedAt: string;
  }>;
}

export interface EproDetail {
  response: {
    id: string;
    subjectId: string;
    status: string;
    entryChannel?: string;
    responses: Record<string, unknown>;
    submittedAt: string | null;
    reviewedAt: string | null;
    submittedBy: string | null;
    reviewedBy: string | null;
    updatedAt: string;
  };
  template: {
    id: string;
    code: string;
    name: string;
    version: string;
    schema: { sections: QuestionnaireSection[] };
  } | null;
  subject: { id: string; subjectCode: string };
  assistedEntry?: AssistedEntryMeta | null;
}

export async function startAssistedEproEntry(input: {
  subjectId: string;
  questionnaireTemplateId: string;
  reason: string;
  collectionChannel: string;
}) {
  return apiPost<{
    assistedEntryId: string;
    responseId: string;
    status: string;
    entryChannel: string;
  }>("/api/epro/assisted-entries/start", input);
}

export async function saveAssistedEproEntry(
  assistedEntryId: string,
  responses: Record<string, unknown>,
) {
  return apiPatch<{ responseId: string; status: string }>(
    `/api/epro/assisted-entries/${assistedEntryId}/save`,
    { responses },
  );
}

export async function submitAssistedEproEntry(
  assistedEntryId: string,
  responses: Record<string, unknown>,
  reason: string,
) {
  return apiPost<{ responseId: string; status: string }>(
    `/api/epro/assisted-entries/${assistedEntryId}/submit`,
    { responses, reason },
  );
}

export async function listEproTemplates(): Promise<{ items: EproTemplate[] }> {
  return apiGet<{ items: EproTemplate[] }>("/api/epro/templates");
}

export async function listEproResponses(params: {
  subjectId?: string;
  status?: string;
} = {}): Promise<EproListResponse> {
  const qs = new URLSearchParams();
  if (params.subjectId) qs.set("subjectId", params.subjectId);
  if (params.status) qs.set("status", params.status);
  qs.set("pageSize", "50");
  return apiGet<EproListResponse>(`/api/epro/responses?${qs}`);
}

export async function getEproResponse(id: string): Promise<EproDetail> {
  return apiGet<EproDetail>(`/api/epro/responses/${id}`);
}

export async function startEproResponse(subjectId: string, templateId: string) {
  return apiPost<{ id: string; status: string }>("/api/epro/responses", {
    subjectId,
    questionnaireTemplateId: templateId,
  });
}

export async function saveEproResponse(id: string, responses: Record<string, unknown>) {
  return apiPatch<{ id: string; status: string }>(
    `/api/epro/responses/${id}`,
    { responses },
  );
}

export async function submitEproResponse(id: string, responses: Record<string, unknown>) {
  return apiPost<{ id: string; status: string }>(
    `/api/epro/responses/${id}/submit`,
    { responses },
  );
}

export async function reviewEproResponse(id: string, notes?: string) {
  return apiPost<{ id: string; status: string }>(
    `/api/epro/responses/${id}/review`,
    { notes },
  );
}
