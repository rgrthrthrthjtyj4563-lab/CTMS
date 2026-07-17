import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Check, X, Edit3, AlertCircle } from 'lucide-react-native';
import { api, type ActionItem } from '../src/lib/api';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

const CTA: Record<string, string> = {
  MONITORING_VISIT_RECORD: '确认访视记录',
  HOURS: '确认工时',
  ISSUE: '确认并创建 Issue',
  TASK: '确认并创建任务',
  REPORT_DRAFT: '确认保存草稿',
  RISK_CANDIDATE: '确认风险候选',
  CAPA_CANDIDATE: '确认 CAPA 候选',
};

export default function ConfirmScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!packId) return;
      void api.actionPack(packId).then((d) => setItems(d.items));
    }, [packId]),
  );

  const done = confirmed.length + skipped.length;
  const allDone = items.length > 0 && done === items.length;
  const progress = items.length ? (done / items.length) * 100 : 0;

  const confirmItem = (id: string) => setConfirmed((p) => [...p, id]);
  const skipItem = (id: string) => setSkipped((p) => [...p, id]);

  const finish = async () => {
    if (!packId || submitting) return;
    setSubmitting(true);
    try {
      await api.confirmActionPack(packId, confirmed, skipped);
      router.replace('/(tabs)/todo');
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : '请检查必确认项后重试');
    } finally {
      setSubmitting(false);
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
          <View style={styles.headerTitle}>
            <Text style={styles.h2}>逐项确认</Text>
            <Text style={styles.h2sub}>
              {done}/{items.length} 已处理 · {confirmed.length} 确认 · {skipped.length} 跳过
            </Text>
          </View>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {items.map((item) => {
          const isC = confirmed.includes(item.id);
          const isS = skipped.includes(item.id);
          const critical = item.type === 'ISSUE' && item.data?.severity === 'HIGH';
          return (
            <Card key={item.id} style={isS ? styles.skipped : critical && !isC ? styles.critical : undefined}>
              <View style={styles.itemRow}>
                <View style={[styles.circle, isC && styles.circleDone, isS && styles.circleSkip]}>
                  {isC && <Check size={14} color={colors.white} strokeWidth={2.5} />}
                  {isS && <X size={13} color={colors.textMuted} />}
                </View>
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, isS && styles.strike]}>{item.title}</Text>
                  {item.description && <Text style={styles.itemSub}>{item.description}</Text>}
                  {critical && !isC && !isS && (
                    <View style={styles.warn}>
                      <AlertCircle size={11} color={colors.red} />
                      <Text style={styles.warnText}>主要 Issue，建议确认后及时通知 PI</Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={() => router.push(`/action-edit?itemId=${item.id}&packId=${packId}`)} hitSlop={8}>
                  <Edit3 size={13} color={colors.textMuted} />
                </Pressable>
              </View>
              {!isC && !isS && (
                <View style={styles.actions}>
                  <Pressable style={styles.skipBtn} onPress={() => skipItem(item.id)}>
                    <Text style={styles.skipText}>跳过</Text>
                  </Pressable>
                  <Pressable style={styles.confirmItemBtn} onPress={() => confirmItem(item.id)}>
                    <Text style={[styles.confirmItemText, item.type === 'ISSUE' && { color: colors.red }]}>
                      {CTA[item.type] ?? '确认'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>

      {allDone && (
        <View style={styles.footer}>
          <Pressable style={styles.finishBtn} onPress={() => void finish()} disabled={submitting}>
            <Text style={styles.finishText}>{submitting ? '提交中…' : '完成确认，查看正式记录 →'}</Text>
          </Pressable>
          <Text style={styles.footerHint}>已确认 {confirmed.length} 项 · 跳过 {skipped.length} 项</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerTitle: { flex: 1 },
  h2: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  h2sub: { fontSize: 11, color: colors.textSecondary },
  progressBg: { height: 4, backgroundColor: '#F3F4F6' },
  progressFill: { height: 4, backgroundColor: colors.primary },
  scroll: { flex: 1 },
  itemRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  circleDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  circleSkip: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: typography.base, fontWeight: '500', color: colors.text },
  itemSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  strike: { color: colors.textMuted, textDecorationLine: 'line-through' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  warnText: { fontSize: 11, color: colors.red },
  skipped: { opacity: 0.4 },
  critical: { borderColor: '#FECACA' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#FAFAFA' },
  skipBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#FAFAFA' },
  skipText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  confirmItemBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  confirmItemText: { fontSize: 12.5, color: colors.primary, fontWeight: '600' },
  footer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight, padding: 16 },
  finishBtn: { height: 48, backgroundColor: colors.primary, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  finishText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  footerHint: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, marginTop: 8 },
});