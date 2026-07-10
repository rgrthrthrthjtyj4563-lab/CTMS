/**
 * Lightweight typed fetch wrapper. All dashboard endpoints go through
 * here so Phase 2 can add a real auth header / request id without
 * touching the components.
 *
 * Phase 2 also injects X-Actor-Id and X-Actor-Role derived from the
 * localStorage session, so the server can re-resolve the user via
 * `requireUser()` and apply role-based masking. The role header is
 * never trusted blindly — the server re-reads the user from Prisma
 * and only honors the role the database returns.
 */
import { loadSession } from "../session.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeaders(): Record<string, string> {
  const session = loadSession();
  if (!session) return {};
  return {
    "X-Actor-Id": session.userId,
    "X-Actor-Role": session.role,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { message?: string }).message ?? res.statusText,
      res.status,
      (body as { requestId?: string }).requestId,
    );
  }
  // 204 No Content / empty body
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
