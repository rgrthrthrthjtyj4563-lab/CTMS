/**
 * Subject list / detail API client. Mirrors the Fastify routes mounted
 * at /api/subjects. All requests go through the auth-aware client so
 * X-Actor-Id / X-Actor-Role headers are attached automatically.
 */
import { apiGet, apiPatch, apiPost } from "./client.js";

export interface SubjectListRow {
  id: string;
  subjectCode: string;
  initials: string | null;
  siteCode: string;
  siteName: string;
  status: string;
  enrollmentDate: string | null;
  owner: string | null;
  ageBand: string | null;
  yearOfBirth: number | null;
  sex: string | null;
}

export interface SubjectListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: SubjectListRow[];
}

export interface SubjectDetail {
  subject: {
    id: string;
    subjectCode: string;
    initials: string | null;
    siteCode: string;
    siteName: string;
    status: string;
    enrollmentDate: string | null;
    ageBand: string | null;
    yearOfBirth: number | null;
    sex: string | null;
    owner: string | null;
  };
  counts: { visits: number; openRisks: number; aes: number };
  visits: Array<{
    id: string;
    visitCode: string;
    status: string;
    scheduledAt: string;
    windowStart: string;
    windowEnd: string;
    isRemote: boolean;
  }>;
  risks: Array<{
    id: string;
    type: string;
    level: string;
    status: string;
    trigger: string;
    suggestion: string | null;
    createdAt: string;
  }>;
  consents: Array<{
    id: string;
    documentTitle: string;
    status: string;
    version: string;
    updatedAt: string;
  }>;
  unmaskAllowed: boolean;
}

export interface SubjectIdentity {
  subjectId: string;
  subjectCode: string;
  fullName: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export async function listSubjects(params: {
  status?: string;
  siteId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<SubjectListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.siteId) qs.set("siteId", params.siteId);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<SubjectListResponse>(`/api/subjects${suffix}`);
}

export async function getSubject(id: string): Promise<SubjectDetail> {
  return apiGet<SubjectDetail>(`/api/subjects/${id}`);
}

export async function getSubjectIdentity(
  id: string,
): Promise<SubjectIdentity> {
  return apiGet<SubjectIdentity>(`/api/subjects/${id}/identity/full`);
}

export async function transitionSubject(
  id: string,
  to: string,
  reason?: string,
): Promise<{ id: string; status: string }> {
  return apiPatch<{ id: string; status: string }>(`/api/subjects/${id}/status`, {
    to,
    reason,
  });
}

export async function withdrawSubject(
  id: string,
  reason: string,
): Promise<{ id: string; status: string; withdrawnDate: string | null }> {
  return apiPost<{ id: string; status: string; withdrawnDate: string | null }>(
    `/api/subjects/${id}/withdraw`,
    { reason },
  );
}
