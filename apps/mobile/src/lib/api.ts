import { getApiBaseUrl } from "./config";
import { loadSession, type SubjectSession } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  session?: SubjectSession | null,
): Promise<T> {
  const s = session ?? (await loadSession());
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(s ? { "X-Actor-Id": s.userId } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new ApiError(
      (body.message as string) ?? res.statusText,
      res.status,
      body.code as string | undefined,
    );
  }
  return body as T;
}

export interface LoginResult {
  session: SubjectSession;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return request<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface SubjectMe {
  subject: { subjectCode: string; status: string };
  project: { code: string; name: string; phase: string };
  dataOrigin: string;
}

export interface TaskItem {
  id: string;
  kind: "questionnaire" | "visit" | "consent";
  title: string;
  status: string;
  bucket: string;
  entryChannel?: string;
}

export interface MyTasks {
  grouped: {
    overdue: TaskItem[];
    today: TaskItem[];
    upcoming: TaskItem[];
    completed: TaskItem[];
  };
  total: number;
  dataOrigin: string;
}

export interface QuestionnaireItem {
  id: string;
  type: "scale" | "single" | "multi" | "text" | "number";
  prompt: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface EproDetail {
  response: {
    id: string;
    status: string;
    entryChannel: string;
    responses: Record<string, unknown>;
  };
  template: {
    name: string;
    version: string;
    schema: { sections: Array<{ id: string; title: string; items: QuestionnaireItem[] }> };
  } | null;
}

export const subjectApi = {
  me: () => request<SubjectMe>("/api/subject/me"),
  myTasks: () => request<MyTasks>("/api/subject/my-tasks"),
  getEpro: (responseId: string) =>
    request<EproDetail>(`/api/subject/epro/responses/${responseId}`),
  saveEpro: (responseId: string, responses: Record<string, unknown>) =>
    request<{ status: string }>(`/api/subject/epro/responses/${responseId}`, {
      method: "PATCH",
      body: JSON.stringify({ responses }),
    }),
  submitEpro: (responseId: string, responses: Record<string, unknown>) =>
    request<{ status: string; entryChannel: string }>(
      `/api/subject/epro/responses/${responseId}/submit`,
      { method: "POST", body: JSON.stringify({ responses }) },
    ),
  submitSymptom: (payload: {
    discomfortType: string;
    onsetAt: string;
    severity: string;
    soughtMedicalCare?: boolean;
    hospitalized?: boolean;
    stoppedMedication?: boolean;
    description: string;
  }) =>
    request<{
      id: string;
      severe: boolean;
      urgentCareGuidance: string | null;
      disclaimer: string;
    }>("/api/subject/symptom-reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};