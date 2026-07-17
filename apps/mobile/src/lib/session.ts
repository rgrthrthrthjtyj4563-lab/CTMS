import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'clinical_token';
const USER_KEY = 'clinical_user';

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  siteId?: string;
  siteName?: string;
  siteCode?: string;
}

export interface Session {
  token: string;
  user: AppUser;
}

export async function saveSession(session: Session): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, session.token],
    [USER_KEY, JSON.stringify(session.user)],
  ]);
}

export async function loadSession(): Promise<Session | null> {
  const [[, token], [, userJson]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  if (!token || !userJson) return null;
  try {
    return { token, user: JSON.parse(userJson) as AppUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function loadToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function loadUser(): Promise<AppUser | null> {
  const json = await AsyncStorage.getItem(USER_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as AppUser;
  } catch {
    return null;
  }
}

export function isCra(role: string): boolean {
  return role === 'CRA';
}

export function isPm(role: string): boolean {
  return role === 'PM';
}

export function isQa(role: string): boolean {
  return role === 'QA';
}