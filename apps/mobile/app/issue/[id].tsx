import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, MoreHorizontal, Info, Plus, Image as ImageIcon, Eye } from 'lucide-react-native';
import { api, type IssueDetail } from '../../src/lib/api';
import { useSession } from '../../src/hooks/useSession';
import { isCra } from '../../src/lib/session';
import { StatusBar } from '../../src/components/StatusBar';
import { Tag } from '../../src/components/Tag';
import { Card } from '../../src/components/Card';
import { colors, radius, typography } from '../../src/theme';

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [data, setData] = useState<IssueDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void api.issue(id).then(setData);
    }, [id]),
  );

  const issue = data?.issue;
  const isMajor = issue && ['HIGH', 'CRITICAL'].includes(issue.severity);
  const craUser = user && isCra(user.role);
  const canPmQaClose = user && (user.role === 'PM' || user.role === 'QA');
  const craMajor = craUser && isMajor;

  const onPrimaryAction = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await api.submitIssueReview(id, canPmQaClose ? 'CLOSED' : 'PENDING_VERIFICATION');
      Alert.alert(craMajor ? '已提交' : '已完成', res.issue.status);
      if (canPmQaClose) router.back();
      else await api.issue(id).then(setData);
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = craMajor
    ? '提交复核'
    : canPmQaClose
      ? '确认关闭 Issue'
      : '确认关闭 Issue';

  const primaryEnabled = craMajor || canPmQaClose;
  const useReviewStyle = craMajor;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitle}>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{issue?.code ?? ''}</Text>
              <Tag status="pending" label="待关闭" />
            </View>
            <Text style={styles.title} numberOfLines={1}>{issue?.title ?? ''}</Text>
          </View>
          <MoreHorizontal size={20} color={colors.textMuted} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <View style={styles.grid}>
            {[
              ['严重程度', issue?.severityLabel ?? '', true],
              ['发现来源', issue?.source ?? '', false],
              ['负责人', issue?.responsiblePerson ?? '', false],
              ['关闭截止', issue?.targetDate ?? '', true],
            ].map(([l, v, highlight], i) => (
              <View key={String(l)} style={[styles.gridCell, i % 2 === 0 && styles.gridBorderR, i < 2 && styles.gridBorderB]}>
                <Text style={styles.gridLabel}>{l}</Text>
                <Text style={[styles.gridValue, highlight && (l === '严重程度' ? styles.severityMajor : styles.dueDate)]}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.cardLabel}>问题描述</Text>
          <Text style={styles.desc}>{issue?.description}</Text>
          <View style={styles.sourceRow}>
            <Info size={10} color={colors.textMuted} />
            <Text style={styles.sourceText}>来源：{issue?.source ?? '系统记录'}</Text>
          </View>
        </Card>

        <Card>
          <View style={styles.evidenceHead}>
            <Text style={styles.cardLabel}>关联证据</Text>
            <Pressable style={styles.addBtn} disabled><Plus size={11} color={colors.border} /><Text style={[styles.addText, { color: colors.textMuted }]}>暂未开放</Text></Pressable>
          </View>
          {data?.evidence.length === 0 && (
            <Text style={styles.noEvidence}>暂无关联证据</Text>
          )}
          {data?.evidence.map((f) => (
            <View key={f.name} style={styles.evidenceRow}>
              <View style={styles.evidenceIcon}><ImageIcon size={13} color={colors.sky} /></View>
              <View style={styles.evidenceBody}>
                <Text style={styles.evidenceName}>{f.name}</Text>
                <Text style={styles.evidenceDesc} numberOfLines={1}>{f.desc}</Text>
                <Text style={styles.evidenceTime}>今日 {f.time} 上传</Text>
              </View>
              <Eye size={15} color={colors.textMuted} />
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.capaHead}>
            <Text style={styles.cardLabel}>纠正措施 CAPA</Text>
            <Tag status="info" label="候选" />
          </View>
          <View style={styles.capaBody}>
            <Text style={styles.capaHint}>
              {data?.capaCandidate.corrective
                ? '以下为动作包中关联的 CAPA 候选'
                : '暂无 CAPA 候选，需在动作包确认后生成'}
            </Text>
            {data?.capaCandidate.corrective ? (
              [
                ['纠正措施', data.capaCandidate.corrective],
                ['预防措施', data.capaCandidate.preventive],
                ['关闭条件', data.capaCandidate.closeCondition],
              ].map(([l, v]) => (
                <View key={l} style={styles.capaItem}>
                  <Text style={styles.capaLabel}>{l}</Text>
                  <Text style={styles.capaText}>{v}</Text>
                </View>
              ))
            ) : null}
          </View>
        </Card>

        <Card>
          <Text style={styles.cardLabel}>操作历史</Text>
          {data?.history.map((h, i) => (
            <View key={i} style={[styles.historyRow, i < (data.history.length - 1) && styles.historyBorder]}>
              <Text style={styles.historyTime}>{h.time}</Text>
              <Text style={styles.historyText}>
                <Text style={styles.historyActor}>{h.actor}</Text>
                <Text style={styles.historyEvent}> · {h.event}</Text>
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.secondaryBtn, { opacity: 0.5 }]} disabled>
          <Text style={styles.secondaryText}>跟进备注（暂未开放）</Text>
        </Pressable>
        <Pressable
          style={[useReviewStyle ? styles.reviewBtn : styles.primaryBtn, !primaryEnabled && styles.primaryDisabled]}
          onPress={() => void onPrimaryAction()}
          disabled={!primaryEnabled}
        >
          <Text style={styles.primaryText}>{busy ? '处理中…' : primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { flex: 1 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  code: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  title: { fontSize: typography.lg, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  cardLabel: { fontSize: 11.5, fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '50%', padding: 14 },
  gridBorderR: { borderRightWidth: 1, borderRightColor: '#FAFAFA' },
  gridBorderB: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  gridLabel: { fontSize: typography.xs, color: colors.textMuted, textTransform: 'uppercase' },
  gridValue: { fontSize: typography.base, color: colors.text, marginTop: 2 },
  severityMajor: { color: colors.red, fontWeight: '700' },
  dueDate: { color: colors.amber, fontWeight: '600' },
  desc: { padding: 14, fontSize: typography.base, color: '#374151', lineHeight: 20 },
  sourceRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingBottom: 12 },
  sourceText: { fontSize: typography.xs, color: colors.textMuted },
  evidenceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  evidenceIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.skyLight, alignItems: 'center', justifyContent: 'center' },
  evidenceBody: { flex: 1 },
  evidenceName: { fontSize: 12.5, fontWeight: '500', color: colors.text },
  evidenceDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  evidenceTime: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  noEvidence: { padding: 16, fontSize: 12, color: colors.textMuted },
  capaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  capaBody: { padding: 14, gap: 12 },
  capaHint: { fontSize: 11, color: colors.amber, fontStyle: 'italic' },
  capaItem: { gap: 4 },
  capaLabel: { fontSize: typography.xs, color: colors.textMuted, textTransform: 'uppercase' },
  capaText: { fontSize: typography.base, color: '#374151', lineHeight: 20 },
  historyRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  historyTime: { width: 40, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  historyText: { flex: 1, fontSize: 12.5 },
  historyActor: { fontWeight: '500', color: colors.text },
  historyEvent: { color: colors.textSecondary },
  footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight },
  secondaryBtn: { flex: 1, height: 44, backgroundColor: '#F3F4F6', borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 13.5, color: '#374151', fontWeight: '500' },
  primaryBtn: { flex: 1, height: 44, backgroundColor: '#059669', borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  reviewBtn: { flex: 1, height: 44, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { fontSize: 13.5, color: colors.white, fontWeight: '600' },
});