import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, ChevronDown, Edit3, Zap, Info,
  Calendar, Clock, AlertTriangle, CheckCircle2, Link2, FileText, TrendingUp,
} from 'lucide-react-native';
import { api, type ActionPackResponse, type ActionItem } from '../src/lib/api';
import { goConfirm } from '../src/lib/navigation';
import { StatusBar } from '../src/components/StatusBar';
import { Tag } from '../src/components/Tag';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

const ICON_MAP: Record<string, { Icon: typeof Calendar; bg: string; color: string }> = {
  MONITORING_VISIT_RECORD: { Icon: Calendar, bg: colors.primaryLight, color: colors.primary },
  HOURS: { Icon: Clock, bg: colors.skyLight, color: colors.sky },
  ISSUE: { Icon: AlertTriangle, bg: colors.redLight, color: colors.red },
  TASK: { Icon: CheckCircle2, bg: colors.amberLight, color: colors.amber },
  FOLLOW_UP_ITEM: { Icon: CheckCircle2, bg: colors.amberLight, color: colors.amber },
  EVIDENCE: { Icon: Link2, bg: colors.violetLight, color: colors.violet },
  REPORT_DRAFT: { Icon: FileText, bg: colors.indigoLight, color: colors.indigo },
  RISK_CANDIDATE: { Icon: TrendingUp, bg: colors.redLight, color: colors.red },
  CAPA_CANDIDATE: { Icon: AlertTriangle, bg: colors.amberLight, color: colors.amber },
};

const TYPE_LABEL: Record<string, string> = {
  MONITORING_VISIT_RECORD: '监查记录候选',
  HOURS: '工时记录候选',
  ISSUE: 'Issue 候选',
  TASK: '后续任务候选',
  FOLLOW_UP_ITEM: '跟进任务候选',
  EVIDENCE: '证据说明候选',
  REPORT_DRAFT: '报告草稿候选',
  RISK_CANDIDATE: '风险候选',
  CAPA_CANDIDATE: 'CAPA 候选',
};

function itemStatusLabel(status?: string, packStatus?: string): string {
  if (packStatus === 'SUBMITTED' || packStatus === 'APPROVED') return '已提交';
  switch (status) {
    case 'CONFIRMED':
    case 'SAVED':
      return '已确认';
    case 'DELETED':
    case 'VOIDED':
      return '已删除';
    case 'EDITED':
      return '待确认（已编辑）';
    case 'PENDING_CONFIRM':
    case 'SUGGESTED':
    default:
      return 'AI 草稿 · 待确认';
  }
}

function severityLabel(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  if (/CRITICAL|Critical/i.test(s)) return 'Critical';
  if (/HIGH|Major/i.test(s)) return 'Major';
  if (/MEDIUM|Minor|LOW/i.test(s)) return 'Minor';
  return s;
}

export default function ActionPackScreen() {
  const { packId, mode } = useLocalSearchParams<{ packId: string; mode?: string }>();
  const isReview = mode === 'review';
  const [data, setData] = useState<ActionPackResponse | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!packId) return;
      void api.actionPack(packId).then(setData);
    }, [packId]),
  );

  const items = data?.items ?? [];
  const followUp = data?.pack.followUpQuestions?.[0];
  const packStatus = data?.pack.status;
  const typeCounts = items.reduce<Record<string, number>>((acc, it) => {
    const k = TYPE_LABEL[it.type] ?? it.type;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const decide = async (decision: 'APPROVE' | 'RETURN' | 'ESCALATE_QA') => {
    if (!packId || busy) return;
    setBusy(true);
    try {
      await api.reviewDecide(packId, decision);
      Alert.alert(
        decision === 'APPROVE' ? '已通过' : decision === 'RETURN' ? '已退回' : '已升级 QA',
        undefined,
        [{ text: '确定', onPress: () => router.replace('/(tabs)/todo') }],
      );
    } catch (e) {
      Alert.alert('操作失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setBusy(false);
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
            <Text style={styles.h2}>{isReview ? '工作包审核' : 'AI 业务候选动作包'}</Text>
            <Text style={styles.h2sub}>
              {isReview
                ? `${items.length} 项 · 请审核后决定通过或退回`
                : `${items.length} 项候选 · 非正式记录，须逐项确认`}
            </Text>
          </View>
          <Tag status={isReview ? 'pending' : 'draft'} label={isReview ? '待审核' : '候选草稿'} />
        </View>
        <View style={styles.notice}>
          <Zap size={12} color={colors.primary} />
          <Text style={styles.noticeText}>
            {isReview
              ? '以下为 CRA 提交的工作包内容。请核对来源与结论后做出审核决定。'
              : '不是语音转写结果页：AI 已把现场素材拆成 Issue / 任务 / 工时 / 报告等业务候选。确认前不写入正式记录；疑似 AE/SAE 仅供人工医学确认。'}
          </Text>
        </View>
        {!isReview && items.length > 0 && (
          <View style={styles.countBar}>
            {Object.entries(typeCounts).map(([label, n]) => (
              <View key={label} style={styles.countChip}>
                <Text style={styles.countChipText}>
                  {label} {n}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {items.map((item, i) => (
          <ActionCard
            key={item.id}
            item={item}
            open={open === i}
            packStatus={packStatus}
            onToggle={() => setOpen(open === i ? null : i)}
            onEdit={
              isReview
                ? undefined
                : () =>
                    router.push({
                      pathname: '/action-edit',
                      params: { itemId: item.id, packId: packId ?? '' },
                    })
            }
          />
        ))}

        {followUp && !isReview && (
          <Card style={styles.followUpCard}>
            <View style={styles.followUpHead}>
              <Zap size={11} color={colors.primary} />
              <Text style={styles.followUpTitle}>AI 补充追问</Text>
            </View>
            <Text style={styles.followUpText}>{followUp}</Text>
            <View style={styles.followUpBtns}>
              <Pressable
                style={styles.followUpSecondary}
                onPress={() => router.push({ pathname: '/ai-followup', params: { question: followUp } })}
              >
                <Text style={styles.followUpSecondaryText}>回答追问</Text>
              </Pressable>
              <Pressable style={[styles.followUpPrimary, { opacity: 0.5 }]} disabled>
                <Text style={styles.followUpPrimaryText}>创建偏差记录（暂未开放）</Text>
              </Pressable>
            </View>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isReview ? (
          <>
            <View style={styles.reviewRow}>
              <Pressable
                style={[styles.reviewBtn, styles.returnBtn]}
                onPress={() => void decide('RETURN')}
                disabled={busy}
              >
                <Text style={styles.returnText}>退回</Text>
              </Pressable>
              <Pressable
                style={[styles.reviewBtn, styles.escalateBtn]}
                onPress={() => void decide('ESCALATE_QA')}
                disabled={busy}
              >
                <Text style={styles.escalateText}>升级 QA</Text>
              </Pressable>
              <Pressable
                style={[styles.reviewBtn, styles.approveBtn]}
                onPress={() => void decide('APPROVE')}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.approveText}>通过</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.footerHint}>审核决定将写入审计并通知相关角色</Text>
          </>
        ) : (
          <>
            <Pressable
              style={styles.confirmBtn}
              onPress={() => packId && goConfirm(packId)}
            >
              <Text style={styles.confirmText}>逐项确认 {items.length} 项动作</Text>
            </Pressable>
            <Text style={styles.footerHint}>确认后写入正式记录，不可撤销</Text>
          </>
        )}
      </View>
    </View>
  );
}

function formatSources(item: ActionItem): string {
  const originLabel =
    item.origin === 'MODEL' ? '模型识别' : item.origin === 'MANUAL' ? '人工补充' : '规则推断';
  const raw = item.sources;
  let excerpts: string[] = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.sources)) {
    excerpts = raw.sources
      .map((s) => s.excerpt)
      .filter((e): e is string => Boolean(e))
      .slice(0, 2);
  } else if (Array.isArray(raw)) {
    excerpts = raw
      .map((s) => s.excerpt)
      .filter((e): e is string => Boolean(e))
      .slice(0, 2);
  }
  if (excerpts.length === 0) {
    return `依据：${originLabel}（无原文摘录，请人工核对）`;
  }
  return `依据：${originLabel} · ${excerpts.map((e) => `「${e.slice(0, 48)}${e.length > 48 ? '…' : ''}」`).join(' ')}`;
}

function ActionCard({
  item, open, onToggle, onEdit, packStatus,
}: {
  item: ActionItem;
  open: boolean;
  packStatus?: string;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const meta = ICON_MAP[item.type] ?? ICON_MAP.MONITORING_VISIT_RECORD;
  const { Icon } = meta;
  const tag = item.tagStatus ?? 'draft';
  const border = tag === 'risk' ? '#FECACA' : tag === 'pending' ? '#FDE68A' : undefined;
  const originTag =
    item.origin === 'MODEL' ? '模型' : item.origin === 'MANUAL' ? '人工' : '规则';
  const typeLabel = TYPE_LABEL[item.type] ?? item.type;
  const statusLabel = itemStatusLabel(item.status, packStatus);
  const data = (item.data ?? {}) as Record<string, unknown>;
  const sev = severityLabel(data.severityBucket ?? data.severity);
  const owner = (data.responsiblePerson ?? data.assignee ?? data.owner) as string | undefined;
  const due = (data.dueDate ?? data.targetDate) as string | undefined;
  const categoryLabel = (data.categoryLabel ?? data.category) as string | undefined;
  const safety =
    data.clinicalSafetyFlag === 'suspected_sae'
      ? '疑似 SAE · 须医学确认'
      : data.clinicalSafetyFlag === 'suspected_ae'
        ? '疑似 AE · 须医学确认'
        : null;
  const summary =
    item.description ||
    (typeof data.description === 'string' ? data.description : '') ||
    (typeof data.workSummary === 'string' ? data.workSummary : '') ||
    '';

  return (
    <Card borderColor={border}>
      <Pressable style={styles.actionHead} onPress={onToggle}>
        <View style={[styles.actionIcon, { backgroundColor: meta.bg }]}>
          <Icon size={14} color={meta.color} />
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          <Text style={styles.actionTitle}>{item.title}</Text>
          <View style={styles.actionMeta}>
            <Tag status={tag} label={statusLabel} />
            <Tag status="info" label={originTag} />
            {sev ? <Tag status="risk" label={sev} /> : null}
          </View>
          {summary ? (
            <Text style={styles.summaryPreview} numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
          <Text style={styles.sourcePreview} numberOfLines={2}>
            {formatSources(item)}
          </Text>
        </View>
        {onEdit ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onEdit();
            }}
            hitSlop={8}
          >
            <Edit3 size={13} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <ChevronDown size={15} color={colors.textMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <View style={styles.actionDetail}>
          {item.description && <Text style={styles.detailText}>{item.description}</Text>}
          <View style={styles.metaGrid}>
            {categoryLabel ? (
              <Text style={styles.metaLine}>分类：{String(categoryLabel)}</Text>
            ) : null}
            {sev ? <Text style={styles.metaLine}>严重等级：{sev}</Text> : null}
            {owner ? <Text style={styles.metaLine}>责任人：{owner}</Text> : null}
            {due ? <Text style={styles.metaLine}>截止：{due}</Text> : null}
            {typeof data.durationHours === 'number' ? (
              <Text style={styles.metaLine}>工时：{data.durationHours} 小时</Text>
            ) : null}
            {safety ? <Text style={[styles.metaLine, { color: colors.red }]}>{safety}</Text> : null}
            <Text style={styles.metaLine}>状态：{statusLabel}</Text>
          </View>
          {item.items?.map((sub, j) => (
            <View key={j} style={styles.subItem}>
              <Text style={styles.subTitle}>{String(sub.title ?? '')}</Text>
            </View>
          ))}
          <View style={styles.sourceRow}>
            <Info size={10} color={colors.textMuted} />
            <Text style={styles.sourceText}>{formatSources(item)}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerTitle: { flex: 1 },
  h2: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  h2sub: { fontSize: 11, color: colors.textSecondary },
  notice: { flexDirection: 'row', gap: 8, padding: 14, backgroundColor: colors.primaryLight, borderBottomWidth: 1, borderBottomColor: `${colors.primary}25` },
  noticeText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18 },
  countBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  countChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  scroll: { flex: 1 },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  actionIcon: { width: 32, height: 32, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  actionBody: { flex: 1 },
  typeLabel: { fontSize: 10.5, fontWeight: '700', color: colors.primary, letterSpacing: 0.3, marginBottom: 2 },
  actionTitle: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  actionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  actionCount: { fontSize: typography.xs, color: colors.textMuted },
  summaryPreview: { marginTop: 4, fontSize: 12, color: '#4B5563', lineHeight: 17 },
  sourcePreview: { marginTop: 4, fontSize: typography.xs, color: colors.textSecondary, lineHeight: 16 },
  actionDetail: { borderTopWidth: 1, borderTopColor: '#FAFAFA', padding: 14, backgroundColor: 'rgba(249,250,251,0.6)' },
  detailText: { fontSize: 12.5, color: '#374151', lineHeight: 20, marginBottom: 8 },
  metaGrid: { gap: 4, marginBottom: 8 },
  metaLine: { fontSize: 12, color: colors.textSecondary },
  subItem: { backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderLight, padding: 10, marginBottom: 6 },
  subTitle: { fontSize: 12.5, fontWeight: '500', color: colors.text },
  sourceRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  sourceText: { fontSize: typography.xs, color: colors.textMuted },
  followUpCard: { borderColor: `${colors.primary}40` },
  followUpHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.primaryLight, borderBottomWidth: 1, borderBottomColor: `${colors.primary}25` },
  followUpTitle: { fontSize: 11.5, fontWeight: '600', color: colors.primary },
  followUpText: { padding: 14, fontSize: typography.base, color: '#374151', lineHeight: 20 },
  followUpBtns: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  followUpSecondary: { flex: 1, height: 36, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  followUpSecondaryText: { fontSize: 12.5, color: '#374151', fontWeight: '500' },
  followUpPrimary: { flex: 1, height: 36, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: `${colors.primary}40`, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  followUpPrimaryText: { fontSize: 12.5, color: colors.primary, fontWeight: '600' },
  footer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight, padding: 16 },
  confirmBtn: { height: 48, backgroundColor: colors.primary, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  footerHint: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 8 },
  reviewRow: { flexDirection: 'row', gap: 8 },
  reviewBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: colors.border },
  returnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  escalateBtn: { backgroundColor: colors.amberLight, borderWidth: 1, borderColor: '#FDE68A' },
  escalateText: { color: '#B45309', fontWeight: '600', fontSize: 14 },
  approveBtn: { backgroundColor: colors.primary },
  approveText: { color: colors.white, fontWeight: '600', fontSize: 14 },
});
