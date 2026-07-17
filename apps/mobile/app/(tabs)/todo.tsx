import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { api, type TodoItem } from '../../src/lib/api';
import { useSession } from '../../src/hooks/useSession';
import { goActionPack, goImvActive, goIssue } from '../../src/lib/navigation';
import { StatusBar } from '../../src/components/StatusBar';
import { BottomNav } from '../../src/components/BottomNav';
import { Card } from '../../src/components/Card';
import { colors, typography } from '../../src/theme';

function openTodo(t: TodoItem, role?: string) {
  // Prefer structured fields over opaque href strings (Web-safe)
  if (t.issueId || (t.sourceType === 'ISSUE' && t.sourceId)) {
    goIssue(t.issueId || t.sourceId!);
    return;
  }
  if (t.sourceType === 'ACTION_PACK' && t.sourceId) {
    const isReviewer = role && ['PM', 'QA', 'ADMIN'].includes(role);
    goActionPack(t.sourceId, isReviewer ? 'review' : undefined);
    return;
  }
  // TASK todos are sourced to their action pack (sourceId = packId).
  if (t.sourceType === 'TASK' && t.sourceId) {
    goActionPack(t.sourceId);
    return;
  }
  if (t.monitoringVisitId || (t.sourceType === 'MONITORING_VISIT' && t.sourceId)) {
    goImvActive(t.monitoringVisitId || t.sourceId!);
    return;
  }
  // Fallback: parse href query for packId/mode
  if (t.href?.includes('action-pack') && t.href.includes('packId=')) {
    const packId = t.href.match(/packId=([^&]+)/)?.[1];
    const mode = t.href.includes('mode=review') ? 'review' as const : undefined;
    if (packId) {
      goActionPack(packId, mode);
      return;
    }
  }
  if (t.href?.startsWith('/issue/')) {
    goIssue(t.href.replace('/issue/', ''));
    return;
  }
  if (t.href) {
    router.push(t.href as `/issue/${string}`);
    return;
  }
  Alert.alert('无法打开', '该待办缺少关联的问题、行动项或访视，请联系管理员检查数据。');
}

export default function TodoScreen() {
  const { user } = useSession();
  const canTeam = user && ['PM', 'QA', 'ADMIN'].includes(user.role);
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [items, setItems] = useState<TodoItem[]>([]);
  const [counts, setCounts] = useState({ mine: 0, all: 0 });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const scope = tab === 'team' && canTeam ? 'team' : 'self';
      const data = await api.todos({ scope });
      setItems(data.items);
      setCounts(data.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [tab, canTeam]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const dueColor = (days: number, urgent: boolean) => {
    if (urgent || days <= 2) return colors.red;
    if (days <= 4) return colors.amber;
    return colors.textSecondary;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <Text style={styles.title}>待办</Text>
        <View style={styles.tabs}>
          {(
            [
              { k: 'mine' as const, l: '我的待办', n: tab === 'mine' ? counts.mine : counts.mine },
              ...(canTeam
                ? [{ k: 'team' as const, l: '团队待办', n: tab === 'team' ? counts.all : counts.all }]
                : []),
            ] as Array<{ k: 'mine' | 'team'; l: string; n: number }>
          ).map((t) => (
            <Pressable key={t.k} style={styles.tabBtn} onPress={() => setTab(t.k)}>
              <Text style={[styles.tabText, tab === t.k && styles.tabActive]}>
                {t.l}
                <Text style={[styles.badge, tab === t.k && styles.badgeActive]}> {t.n}</Text>
              </Text>
              {tab === t.k && <View style={styles.tabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <Pressable style={styles.errorBanner} onPress={() => void load()}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>重试</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {items.map((t) => (
          <Pressable key={t.id} onPress={() => openTodo(t, user?.role)}>
            <Card style={t.urgent ? styles.urgentCard : undefined}>
              <View style={styles.row}>
                <View style={[styles.checkbox, t.urgent && styles.checkboxUrgent]} />
                <View style={styles.body}>
                  <Text style={styles.itemTitle}>{t.title}</Text>
                  {t.project ? <Text style={styles.itemProject}>{t.project}</Text> : null}
                  <View style={styles.meta}>
                    <Text style={[styles.due, { color: dueColor(t.days, t.urgent) }]}>
                      截止 {t.due || '待定'}
                      {t.urgent ? ' · 紧急' : t.days <= 4 ? ' · 临近' : ''}
                    </Text>
                    <Text style={styles.source}>来自 {t.source}</Text>
                  </View>
                </View>
                <ChevronRight size={14} color={colors.border} />
              </View>
            </Card>
          </Pressable>
        ))}
        {items.length === 0 && !error && <Text style={styles.empty}>暂无待办</Text>}
      </ScrollView>
      <BottomNav active="todo" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, paddingHorizontal: 16 },
  title: { fontSize: typography.xxl, fontWeight: '700', color: colors.text, marginBottom: 12 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tabBtn: { paddingHorizontal: 16, paddingBottom: 10 },
  tabText: { fontSize: typography.base, fontWeight: '600', color: colors.textMuted },
  tabActive: { color: colors.primary },
  badge: { fontSize: 11, backgroundColor: '#F3F4F6', color: colors.textSecondary, paddingHorizontal: 6, borderRadius: 10 },
  badgeActive: { backgroundColor: colors.primaryLight, color: colors.primary },
  tabLine: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: colors.primary },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: '#B45309' },
  errorRetry: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  checkbox: { width: 15, height: 15, borderRadius: 3, borderWidth: 2, borderColor: '#D1D5DB', marginTop: 3 },
  checkboxUrgent: { borderColor: '#F87171' },
  body: { flex: 1 },
  itemTitle: { fontSize: typography.base, fontWeight: '500', color: colors.text },
  itemProject: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  due: { fontSize: 11, fontWeight: '600' },
  source: { fontSize: 11, color: colors.textMuted },
  urgentCard: { borderColor: '#FECACA' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: 40 },
});
