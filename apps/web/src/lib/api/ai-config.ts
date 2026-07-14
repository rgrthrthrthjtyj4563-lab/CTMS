/**
 * AI 中台配置 API client. Mirrors the Fastify routes mounted at
 * /api/ai-config/*.
 *
 * Phase 3 Task 3.6: configs / prompts / call-logs / outputs queue +
 * adopt / reject. The UI subscribes to the same JSON shape the API
 * returns; types here are kept narrow to match the route response
 * exactly.
 */
import { apiGet, apiPost, apiPut } from "./client.js";

export interface AIConfigRow {
  id: string;
  projectId: string | null;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIConfigListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AIConfigRow[];
}

export interface PromptTemplateRow {
  id: string;
  code: string;
  version: string;
  body: string;
  variables: unknown;
  outputKind: string;
  createdAt: string;
}

export interface PromptTemplateListResponse {
  items: PromptTemplateRow[];
}

export interface AICallLogRow {
  id: string;
  projectId: string;
  module: string;
  caller: string;
  inputHash: string;
  model: string;
  promptTemplateCode: string | null;
  promptVersion: string | null;
  aiOutputId: string | null;
  aiOutputKind: string | null;
  aiOutputStatus: string | null;
  startedAt: string;
  finishedAt: string | null;
  statusCode: number | null;
  errorMessage: string | null;
}

export interface AICallLogListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AICallLogRow[];
}

export type AIOutputStatus =
  | "Pending"
  | "Adopted"
  | "EditedAdopted"
  | "Rejected"
  | "NeedsInvestigatorConfirmation";

export interface AIOutputRow {
  id: string;
  kind: string;
  projectId: string;
  subjectId: string | null;
  confidence: number;
  confidenceLevel: string;
  status: AIOutputStatus;
  model: string;
  modelVersion: string;
  inputHash: string;
  promptTemplateCode: string | null;
  promptVersion: string | null;
  payload: unknown;
  generatedAt: string;
  confirmedByUserId: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  notes: string | null;
  rejectionReason: string | null;
}

export interface AIOutputListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AIOutputRow[];
}

export interface ListAIConfigsParams {
  projectId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAICallLogsParams {
  projectId?: string;
  model?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAIOutputsParams {
  projectId?: string;
  kind?: string;
  status?: AIOutputStatus;
  page?: number;
  pageSize?: number;
}

export async function listAIConfigs(
  params: ListAIConfigsParams = {},
): Promise<AIConfigListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<AIConfigListResponse>(`/api/ai-config/configs${suffix}`);
}

export async function updateAIConfig(
  configId: string,
  body: Partial<{
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number | null;
    enabled: boolean;
  }>,
): Promise<AIConfigRow> {
  return apiPut<AIConfigRow>(`/api/ai-config/configs/${configId}`, body);
}

export async function listPromptTemplates(): Promise<PromptTemplateListResponse> {
  return apiGet<PromptTemplateListResponse>("/api/ai-config/prompts");
}

export async function createPromptVersion(body: {
  code: string;
  body: string;
  variables?: string[];
  outputKind: string;
  version?: string;
}): Promise<PromptTemplateRow> {
  return apiPost<PromptTemplateRow>("/api/ai-config/prompts", body);
}

export async function listAICallLogs(
  params: ListAICallLogsParams = {},
): Promise<AICallLogListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<AICallLogListResponse>(`/api/ai-config/call-logs${suffix}`);
}

export async function listAIOutputs(
  params: ListAIOutputsParams = {},
): Promise<AIOutputListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<AIOutputListResponse>(`/api/ai-config/outputs${suffix}`);
}

export async function adoptAIOutput(
  outputId: string,
  notes?: string,
): Promise<{
  id: string;
  status: AIOutputStatus;
  confirmedByUserId: string;
  confirmedAt: string;
}> {
  return apiPost(`/api/ai-config/outputs/${outputId}/adopt`, { notes });
}

export async function rejectAIOutput(
  outputId: string,
  reason: string,
  notes?: string,
): Promise<{
  id: string;
  status: AIOutputStatus;
  confirmedByUserId: string;
  confirmedAt: string;
  rejectionReason: string;
}> {
  return apiPost(`/api/ai-config/outputs/${outputId}/reject`, {
    reason,
    notes,
  });
}
