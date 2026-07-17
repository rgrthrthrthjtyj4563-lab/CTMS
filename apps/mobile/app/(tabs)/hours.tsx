import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { api, type HoursResponse } from '../../src/lib/api';
import { StatusBar } from '../../src/components/StatusBar';
import { BottomNav } from '../../src/components/BottomNav';
import { Tag, type TagStatus } from '../../src/components/Tag';
import { Card } from '../../src/components/Card';
import { colors, radius, typography } from '../../src/theme';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: '全部' },
  { key: 'DRAFT_CANDIDATE', label: '待确认' },
  { key: 'CRA_CONFIRMED', label: '已确认' },
  { key: 'PENDING_PM_REVIEW', label: '待审批' },
  { key: 'APPROVED', label: '已审批' },
  { key: 'RETURNED', label: '已退回' },
];

export default function HoursScreen() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [status, setStatus] = useState('');
  const [data, setData] = useState<HoursResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        await api.hours({
          month,
          status: status || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [month, status]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const summary = data?.summary;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <Text style={styles.title}>我的工时</Text>
        <Text style={styles.sub}>随访视总结确认；本页用于查询与核对</Text>
        <View style={styles.monthRow}>
          <Pressable
            style={styles.monthBtn}
            onPress={() => setMonth((m) => shiftMonth(m, -1))}
            accessibilityRole="button"
            accessibilityLabel="上一月"
          >
            <ChevronLeft size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.monthLabel} accessibilityRole="header">
            {summary?.monthLabel ?? month}
          </Text>
          <Pressable
            style={styles.monthBtn}
            onPress={() => setMonth((m) => shiftMonth(m, 1))}
            accessibilityRole="button"
            accessibilityLabel="下一月"
          >
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key || 'all'}
            style={[styles.filterChip, status === f.key && styles.filterActive]}
            onPress={() => setStatus(f.key)}
          >
            <Text style={[styles.filterText, status === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <Pressable style={styles.errorBanner} onPress={() => void load()}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>重试</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>本月工时合计</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{summary?.monthTotal ?? 0}</Text>
            <Text style={styles.summaryUnit}>小时</Text>
          </View>
          <View style={styles.statsGrid}>
            {[
              [`${summary?.visitDays ?? 0}条`, '现场监查'],
              [`${summary?.travelDays ?? 0}条`, '差旅'],
              [summary?.approvalStatus ?? '—', '状态'],
            ].map(([v, l]) => (
              <View key={l} style={styles.statBox}>
                <Text style={styles.statLabel}>{l}</Text>
                <Text style={styles.statValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <Card>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>工时明细</Text>
            <Text style={styles.listLink}>{data?.entries.length ?? 0} 条</Text>
          </View>
          {data?.entries.map((e, i) => (
            <View
              key={e.id}
              style={[styles.entry, i < (data.entries.length - 1) && styles.entryBorder]}
            >
              <View style={styles.dateCol}>
                <Text style={styles.dateText}>{e.date}</Text>
                <Text style={styles.dayText}>{e.day}</Text>
              </View>
              <Text style={styles.entryDesc} numberOfLines={1}>{e.desc}</Text>
              <View style={styles.entryRight}>
                <Text style={styles.entryHours}>{e.hours}h</Text>
                <Tag status={e.tagStatus as TagStatus} label={e.tagLabel} />
              </View>
            </View>
          ))}
          {(!data || data.entries.length === 0) && (
            <Text style={styles.empty}>该月份暂无工时记录</Text>
          )}
        </Card>

        <Text style={styles.hint}>
          工时由访视总结确认写入。本页不提供月度汇总提交，避免与访视审核双轨。
        </Text>
      </ScrollView>
      <BottomNav active="mine" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: typography.xxl, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  monthBtn: { padding: 4 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 100, textAlign: 'center' },
  filters: { maxHeight: 44, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingHorizontal: 12 },
  filterChip: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginVertical: 8,
  },
  filterActive: { backgroundColor: colors.primaryLight },
  filterText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.primary, fontWeight: '600' },
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
  scroll: { flex: 1 },
  summaryCard: { backgroundColor: colors.dark, borderRadius: radius.card, padding: 16 },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  summaryValue: { fontSize: 38, fontWeight: '700', color: colors.white, lineHeight: 40 },
  summaryUnit: { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '600', color: colors.white },
  listHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  listTitle: { fontSize: 11.5, fontWeight: '600', color: '#4B5563', textTransform: 'uppercase' },
  listLink: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  entryBorder: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  dateCol: { width: 40, alignItems: 'center' },
  dateText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  dayText: { fontSize: 10, color: colors.textMuted },
  entryDesc: { flex: 1, fontSize: 13, color: colors.text },
  entryRight: { alignItems: 'flex-end', gap: 4 },
  entryHours: { fontSize: 14, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, padding: 24 },
  hint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
});
