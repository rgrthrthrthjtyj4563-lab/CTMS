/**
 * Visit API client. Mirrors /api/visits.
 */
import { apiGet, apiPatch, apiPost } from "./client.js";

export interface VisitListRow {
  id: string;
  subjectId: string;
  subjectCode: string;
  visitCode: string;
  status: string;
  scheduledAt: string;
  windowStart: string;
  windowEnd: string;
  isRemote: boolean;
  remote: {
    startedAt: string;
    endedAt: string | null;
    videoProvider: string | null;
    videoSessionId: string | null;
  } | null;
  taskCount: number;
  taskDone: number;
}

export interface VisitListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: VisitListRow[];
}

export interface VisitTask {
  id: string;
  code: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
}

export interface VisitDetail {
  visit: {
    id: string;
    subjectId: string;
    subjectCode: string;
    visitCode: string;
    status: string;
    scheduledAt: string;
    windowStart: string;
    windowEnd: string;
  };
  tasks: VisitTask[];
  remote: {
    startedAt: string;
    endedAt: string | null;
    videoProvider: string | null;
    videoSessionId: string | null;
    notes: string | null;
  } | null;
}

export async function listVisits(params: {
  subjectId?: string;
  status?: string;
} = {}): Promise<VisitListResponse> {
  const qs = new URLSearchParams();
  if (params.subjectId) qs.set("subjectId", params.subjectId);
  if (params.status) qs.set("status", params.status);
  qs.set("pageSize", "50");
  return apiGet<VisitListResponse>(`/api/visits?${qs}`);
}

export async function getVisit(id: string): Promise<VisitDetail> {
  return apiGet<VisitDetail>(`/api/visits/${id}`);
}

export async function transitionVisit(
  id: string,
  to: string,
  reason?: string,
) {
  return apiPatch<{ id: string; status: string }>(`/api/visits/${id}/status`, {
    to,
    reason,
  });
}

export async function startRemoteVisit(
  id: string,
  videoProvider: string,
  videoSessionId: string,
) {
  return apiPost<{ id: string; visitId: string; startedAt: string }>(
    `/api/visits/${id}/remote`,
    { videoProvider, videoSessionId },
  );
}

export async function toggleVisitTask(
  visitId: string,
  taskId: string,
  completed: boolean,
) {
  return apiPatch<{ id: string; completed: boolean; completedAt: string | null }>(
    `/api/visits/${visitId}/tasks/${taskId}`,
    { completed },
  );
}
