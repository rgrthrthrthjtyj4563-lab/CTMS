import type { Session } from "../session.js";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  session: Session;
}

/**
 * Login API call. Phase 1 uses a server-validated mock: the Fastify
 * `/api/auth/login` route accepts a seed user email and any password
 * ≥ 4 chars. The server returns the user's primary project, role, and
 * display name. We avoid storing raw passwords anywhere.
 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { message?: string }).message ?? "登录失败，请检查账号密码";
    throw new Error(message);
  }
  return (await res.json()) as LoginResponse;
}
