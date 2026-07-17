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
  EVIDENCE: { Icon: Link2, bg: colors.violetLight, color: colors.violet },
  REPORT_DRAFT: { Icon: FileText, bg: colors.indigoLight, color: colors.indigo },
  RISK_CANDIDATE: { Icon: TrendingUp, bg: colors.redLight, color: colors.red },
  CAPA_CANDIDATE: { Icon: AlertTriangle, bg: colors.amberLight, color: colors.amber },
};

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
            <Text style={styles.h2}>{isReview ? '工作包审核' : 'AI 整理结果'}</Text>
            <Text style={styles.h2sub}>
              {isReview
                ? `${items.length} 项 · 请审核后决定通过或退回`
                : `${items.length} 项业务动作 · 请逐项审查后确认`}
            </Text>
          </View>
          <Tag status={isReview ? 'pending' : 'draft'} label={isReview ? '待审核' : '草稿'} />
        </View>
        <View style={styles.notice}>
          <Zap size={12} color={colors.primary} />
          <Text style={styles.noticeText}>
            {isReview
              ? '以下为 CRA 提交的工作包内容。请核对来源与结论后做出审核决定。'
              : 'AI 已识别以下业务动作。所有内容为草稿，确认后才写入正式记录。'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {items.map((item, i) => (
          <ActionCard
            key={item.id}
            item={item}
            open={open === i}
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
  item, open, onToggle, onEdit,
}: {
  item: ActionItem;
  open: boolean;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const meta = ICON_MAP[item.type] ?? ICON_MAP.MONITORING_VISIT_RECORD;
  const { Icon } = meta;
  const tag = item.tagStatus ?? 'draft';
  const border = tag === 'risk' ? '#FECACA' : tag === 'pending' ? '#FDE68A' : undefined;
  const originTag =
    item.origin === 'MODEL' ? '模型' : item.origin === 'MANUAL' ? '人工' : '规则';

  return (
    <Card borderColor={border}>
      <Pressable style={styles.actionHead} onPress={onToggle}>
        <View style={[styles.actionIcon, { backgroundColor: meta.bg }]}>
          <Icon size={14} color={meta.color} />
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>{item.title}</Text>
          <View style={styles.actionMeta}>
            <Tag status={tag} />
            <Tag status="info" label={originTag} />
            <Text style={styles.actionCount}>1 项</Text>
          </View>
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
  scroll: { flex: 1 },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  actionIcon: { width: 32, height: 32, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  actionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  actionCount: { fontSize: typography.xs, color: colors.textMuted },
  actionDetail: { borderTopWidth: 1, borderTopColor: '#FAFAFA', padding: 14, backgroundColor: 'rgba(249,250,251,0.6)' },
  detailText: { fontSize: 12.5, color: '#374151', lineHeight: 20, marginBottom: 8 },
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
