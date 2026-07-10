import type { Role } from "@aic-dct/domain";

export interface Session {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  organization?: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  loggedInAt: string;
}

const STORAGE_KEY = "aic-dct.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
