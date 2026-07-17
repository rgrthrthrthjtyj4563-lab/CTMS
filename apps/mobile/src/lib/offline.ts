import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncPayload } from '@clinical/domain';

const DRAFTS_KEY = 'offline_drafts';
const CLIENT_ID_KEY = 'offline_client_id';

export interface OfflineDraft {
  id: string;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  syncStatus: 'PENDING' | 'CONFLICT' | 'SYNCED' | 'FAILED';
}

export async function getClientId(): Promise<string> {
  let id = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client-${Date.now().toString(36)}`;
    await AsyncStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export async function loadOfflineDrafts(): Promise<OfflineDraft[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineDraft[];
  } catch {
    return [];
  }
}

export async function saveOfflineDraft(draft: OfflineDraft): Promise<void> {
  const drafts = await loadOfflineDrafts();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.push(draft);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export async function removeOfflineDraft(id: string): Promise<void> {
  const drafts = (await loadOfflineDrafts()).filter((d) => d.id !== id);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export async function buildSyncPayload(): Promise<SyncPayload> {
  const clientId = await getClientId();
  const drafts = await loadOfflineDrafts();
  const inputs = drafts
    .filter((d) => d.entityType === 'VisitInput' && d.syncStatus === 'PENDING')
    .map((d) => ({
      clientInputId: d.id,
      monitoringVisitId: String(d.payload.monitoringVisitId ?? ''),
      type: (d.payload.type as 'TEXT' | 'VOICE' | 'IMAGE' | 'FILE') ?? 'TEXT',
      content: String(d.payload.content ?? ''),
      createdAt: d.createdAt,
    }));
  return { clientId, inputs };
}

export async function queueVisitInput(
  visitId: string,
  type: 'TEXT' | 'VOICE',
  content: string,
  transcript?: string,
): Promise<OfflineDraft> {
  const draft: OfflineDraft = {
    id: `input-${Date.now().toString(36)}`,
    entityType: 'VisitInput',
    payload: { monitoringVisitId: visitId, type, content, transcript },
    createdAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  };
  await saveOfflineDraft(draft);
  return draft;
}