import AsyncStorage from "@react-native-async-storage/async-storage";
export interface SubjectSession {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  loggedInAt: string;
}

const KEY = "aic-dct.subject.session";

export async function loadSession(): Promise<SubjectSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubjectSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: SubjectSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}