import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, WifiOff, RefreshCw } from 'lucide-react-native';
import { loadOfflineDrafts, buildSyncPayload, type OfflineDraft } from '../src/lib/offline';
import { api } from '../src/lib/api';
import { StatusBar } from '../src/components/StatusBar';
import { Tag } from '../src/components/Tag';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

export default function OfflineDraftScreen() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string>('');

  const load = useCallback(async () => {
    setDrafts(await loadOfflineDrafts());
    try {
      const s = await api.syncStatus();
      setStatus(s.needsSync ? 'PENDING' : 'SYNCED');
    } catch {
      setStatus('OFFLINE');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sync = async () => {
    setSyncing(true);
    try {
      const payload = await buildSyncPayload();
      const res = await api.sync(payload);
      if (res.conflicts?.length) {
        router.push('/sync-conflict');
      } else {
        await load();
      }
    } catch {
      setStatus('FAILED');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>离线草稿</Text>
          <Tag status={status === 'SYNCED' ? 'done' : 'pending'} label={status || '待同步'} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {drafts.length === 0 ? (
          <Card style={styles.empty}>
            <WifiOff size={24} color={colors.textMuted} />
            <Text style={styles.emptyText}>暂无离线草稿</Text>
          </Card>
        ) : (
          drafts.map((d) => (
            <Card key={d.id}>
              <View style={styles.draftRow}>
                <Text style={styles.draftType}>{d.entityType}</Text>
                <Tag status={d.syncStatus === 'PENDING' ? 'pending' : 'warning'} label={d.syncStatus} />
              </View>
              <Text style={styles.draftContent} numberOfLines={2}>
                {String(d.payload.content ?? JSON.stringify(d.payload))}
              </Text>
              <Text style={styles.draftTime}>{new Date(d.createdAt).toLocaleString('zh-CN')}</Text>
            </Card>
          ))
        )}
      </ScrollView>

      {drafts.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={styles.syncBtn} onPress={() => void sync()} disabled={syncing}>
            <RefreshCw size={16} color={colors.white} />
            <Text style={styles.syncText}>{syncing ? '同步中…' : '立即同步'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { flex: 1, fontSize: typography.xl, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: typography.base },
  draftRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, paddingBottom: 6 },
  draftType: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  draftContent: { paddingHorizontal: 14, fontSize: typography.base, color: colors.text },
  draftTime: { padding: 14, paddingTop: 6, fontSize: 11, color: colors.textMuted },
  footer: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight },
  syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, backgroundColor: colors.primary, borderRadius: radius.button },
  syncText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});