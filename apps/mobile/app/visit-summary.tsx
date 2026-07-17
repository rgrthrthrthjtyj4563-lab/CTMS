import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  Clock,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
} from 'lucide-react-native';
import { api, ApiError, type ActionItem } from '../src/lib/api';
import { paramStr } from '../src/lib/params';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { Tag } from '../src/components/Tag';
import { colors, radius, typography } from '../src/theme';

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
}

export default function VisitSummaryScreen() {
  const raw = useLocalSearchParams<{
    visitId?: string | string[];
    packId?: string | string[];
  }>();
  const visitId = paramStr(raw.visitId);
  const packIdParam = paramStr(raw.packId) || undefined;

  const [loading, setLoading] = useState(true);
  const [loadingHint, setLoadingHint] = useState('整理访视总结…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packId, setPackId] = useState<string | null>(packIdParam ?? null);
  const [visit, setVisit] = useState<{
    status: string;
    projectCode: string;
    siteName: string;
    actualStartTime?: string | null;
    actualEndTime?: string | null;
    durationMinutes?: number | null;
    workSummary?: string | null;
  } | null>(null);
  const [activities, setActivities] = useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [endTimeLocal, setEndTimeLocal] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async (opts?: { autoOpenPack?: boolean }) => {
    if (!visitId) return;
    setLoading(true);
    setError(null);
    const autoOpen = opts?.autoOpenPack !== false;
    try {
      // Staged AI organize feedback (product narrative, not raw "generating pack")
      setLoadingHint('正在汇总现场记录…');
      await new Promise((r) => setTimeout(r, 280));

      let resolvedPackId = packIdParam ?? null;
      if (!resolvedPackId) {
        setLoadingHint('正在识别 Issue 和风险…');
        await new Promise((r) => setTimeout(r, 200));
        setLoadingHint('正在生成任务、工时和报告草稿…');
        const complete = await api.completeVisit(visitId);
        resolvedPackId = complete.actionPack?.id ?? null;
      } else {
        setLoadingHint('加载已有行动包（不重复生成）…');
      }
      setPackId(resolvedPackId);

      setLoadingHint('整理完成，请确认…');
      const detail = await api.visitDetail(visitId);
      setVisit({
        status: detail.visit.status,
        projectCode: detail.visit.project.code,
        siteName: detail.visit.site.name,
        actualStartTime: detail.visit.actualStartTime,
        actualEndTime: detail.visit.actualEndTime,
        durationMinutes: detail.visit.durationMinutes,
        workSummary: detail.visit.workSummary,
      });

      const end = detail.visit.actualEndTime
        ? new Date(detail.visit.actualEndTime)
        : new Date();
      setEndTimeLocal(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      );
      if (detail.visit.workSummary) setNote(detail.visit.workSummary);

      try {
        const act = await api.visitActivities(visitId);
        setActivities(act.activities);
      } catch {
        setActivities([]);
      }

      if (resolvedPackId) {
        const pack = await api.actionPack(resolvedPackId);
        setItems(pack.items);
        // Product flow: after organize, land on AI action pack (candidates), not stuck on summary.
        if (autoOpen && pack.items.length > 0 && !packIdParam) {
          setLoading(false);
          router.replace({
            pathname: '/action-pack',
            params: { packId: resolvedPackId },
          });
          return;
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [visitId, packIdParam]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const hoursItem = items.find((i) => i.type === 'HOURS');
  const issueItems = items.filter((i) => i.type === 'ISSUE');
  const taskItems = items.filter((i) => i.type === 'TASK' || i.type === 'FOLLOW_UP_ITEM');
  const mvItem = items.find((i) => i.type === 'MONITORING_VISIT_RECORD');
  const pendingActivities = activities.filter((a) => a.status === 'PENDING');

  const applyEndTime = async () => {
    if (!visitId || !endTimeLocal.match(/^\d{1,2}:\d{2}$/)) {
      Alert.alert('时间格式', '请使用 HH:mm 格式，例如 17:40');
      return;
    }
    const base = visit?.actualEndTime
      ? new Date(visit.actualEndTime)
      : visit?.actualStartTime
        ? new Date(visit.actualStartTime)
        : new Date();
    const [hh, mm] = endTimeLocal.split(':').map(Number);
    base.setHours(hh, mm, 0, 0);
    setBusy(true);
    try {
      await api.patchVisit(visitId, {
        actualEndTime: base.toISOString(),
        workSummary: note.trim() || undefined,
      });
      // Keep hours action data aligned if present
      if (packId && hoursItem) {
        const start = visit?.actualStartTime ? new Date(visit.actualStartTime) : base;
        const durationHours =
          Math.round(((base.getTime() - start.getTime()) / 3600000) * 10) / 10;
        await api.updateActionItem(packId, hoursItem.id, {
          ...hoursItem.data,
          endTime: endTimeLocal,
          durationHours: durationHours > 0 ? durationHours : hoursItem.data.durationHours,
          description: (hoursItem.data.description as string) || 'IMV现场监查',
        });
      }
      await load();
      Alert.alert('已更新', '结束时间已确认');
    } catch (e) {
      Alert.alert('更新失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setBusy(false);
    }
  };

  const goActionPack = () => {
    if (!packId) {
      Alert.alert('暂无行动包', '请返回重试结束访视');
      return;
    }
    router.push(`/action-pack?packId=${packId}`);
  };

  const goConfirm = () => {
    if (!packId) {
      Alert.alert('暂无行动包', '请返回重试结束访视');
      return;
    }
    router.push(`/confirm?packId=${packId}`);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingTitle}>正在整理现场记录</Text>
        <Text style={styles.loadingText}>{loadingHint}</Text>
        <Text style={styles.loadingSub}>
          AI 将拆出 Issue / 任务 / 工时 / 报告草稿等候选，不会直接写入正式记录
        </Text>
      </View>
    );
  }

  if (error && !packId) {
    return (
      <View style={[styles.screen, styles.center, { padding: 24 }]}>
        <AlertTriangle size={28} color={colors.amber} />
        <Text style={styles.failTitle}>整理失败</Text>
        <Text style={styles.failText}>{error}</Text>
        <Pressable style={styles.retryPrimary} onPress={() => void load({ autoOpenPack: true })}>
          <Text style={styles.retryPrimaryText}>重新整理</Text>
        </Pressable>
        <Pressable
          style={styles.retryGhost}
          onPress={() =>
            visitId
              ? router.replace({ pathname: '/imv-active', params: { visitId } })
              : router.back()
          }
        >
          <Text style={styles.retryGhostText}>返回现场记录</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable
            onPress={() =>
              visitId
                ? router.replace({ pathname: '/imv-active', params: { visitId } })
                : router.back()
            }
          >
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.h2}>结束访视 · AI 已整理</Text>
            <Text style={styles.h2sub}>
              {visit?.projectCode} · {visit?.siteName}
            </Text>
          </View>
          <Tag status="pending" label="候选草稿" />
        </View>
        <View style={styles.notice}>
          <Info size={12} color={colors.primary} />
          <Text style={styles.noticeText}>
            已根据现场素材生成业务候选（非正式记录）。请先看行动包中的 Issue / 任务 / 工时 /
            报告草稿，再逐项确认。再次进入不会重复生成。
          </Text>
        </View>
      </View>

      {error ? (
        <Pressable style={styles.errorBanner} onPress={() => void load({ autoOpenPack: false })}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>重试</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Card>
          <View style={styles.sectionHead}>
            <Clock size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>访视时间与工时</Text>
          </View>
          <View style={styles.timeGrid}>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>开始</Text>
              <Text style={styles.timeValue}>{fmtTime(visit?.actualStartTime)}</Text>
            </View>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>结束 (HH:mm)</Text>
              <TextInput
                style={styles.timeInput}
                value={endTimeLocal}
                onChangeText={setEndTimeLocal}
                placeholder="17:40"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>总时长</Text>
              <Text style={styles.timeValue}>{fmtDuration(visit?.durationMinutes)}</Text>
            </View>
          </View>
          {hoursItem ? (
            <Text style={styles.hoursHint}>
              工时候选：{String(hoursItem.data.durationHours ?? '—')} 小时 ·{' '}
              {hoursItem.origin === 'RULE' ? '规则推断' : '模型识别'}
            </Text>
          ) : (
            <Text style={styles.hoursHint}>未识别到工时候选，可在行动包中人工补充</Text>
          )}
          <TextInput
            style={styles.noteInput}
            placeholder="工作摘要（可选）"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Pressable style={styles.secondaryBtn} onPress={() => void applyEndTime()} disabled={busy}>
            <Text style={styles.secondaryBtnText}>{busy ? '保存中…' : '确认时间与摘要'}</Text>
          </Pressable>
        </Card>

        <Card>
          <View style={styles.sectionHead}>
            <ClipboardList size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              访视活动 {activities.filter((a) => a.status === 'DONE').length}/{activities.length}
            </Text>
          </View>
          {activities.map((a) => (
            <View key={a.id} style={styles.listRow}>
              <CheckCircle2
                size={14}
                color={a.status === 'DONE' ? colors.primary : colors.border}
              />
              <Text style={styles.listText}>{a.title}</Text>
              <Text style={styles.listMeta}>
                {a.status === 'DONE' ? '已完成' : a.status === 'NA' ? '不适用' : '待完成'}
              </Text>
            </View>
          ))}
          {pendingActivities.length > 0 && (
            <View style={styles.warnBox}>
              <AlertTriangle size={12} color={colors.amber} />
              <Text style={styles.warnText}>
                仍有 {pendingActivities.length} 项活动未完成，可返回现场页补充，或继续确认并注明原因。
              </Text>
            </View>
          )}
        </Card>

        <Card>
          <View style={styles.sectionHead}>
            <AlertTriangle size={14} color={colors.red} />
            <Text style={styles.sectionTitle}>问题 ({issueItems.length})</Text>
          </View>
          {issueItems.length === 0 ? (
            <Text style={styles.empty}>未识别到问题候选</Text>
          ) : (
            issueItems.map((i) => (
              <View key={i.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listText}>{i.title}</Text>
                  {i.description ? (
                    <Text style={styles.listSub} numberOfLines={2}>{i.description}</Text>
                  ) : null}
                </View>
                <Tag status="risk" label={String(i.data.severity ?? '')} />
              </View>
            ))
          )}
        </Card>

        <Card>
          <View style={styles.sectionHead}>
            <FileText size={14} color={colors.sky} />
            <Text style={styles.sectionTitle}>行动项与跟进 ({taskItems.length})</Text>
          </View>
          {taskItems.length === 0 ? (
            <Text style={styles.empty}>暂无行动项</Text>
          ) : (
            taskItems.map((i) => (
              <View key={i.id} style={styles.listRow}>
                <Text style={styles.listText}>{i.title}</Text>
              </View>
            ))
          )}
          {mvItem ? (
            <Text style={styles.hoursHint}>
              访视记录：{String(mvItem.data.workSummary ?? mvItem.description ?? '').slice(0, 80)}
            </Text>
          ) : null}
        </Card>

        <Text style={styles.footerNote}>
          共 {items.length} 条 AI/规则建议 · 确认写入前均为草稿
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.ghostFooter} onPress={goConfirm}>
          <Text style={styles.ghostFooterText}>逐项确认</Text>
        </Pressable>
        <Pressable style={styles.primaryFooter} onPress={goActionPack}>
          <Text style={styles.primaryFooterText}>查看 AI 整理结果 →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingTitle: { marginTop: 16, fontSize: 16, fontWeight: '700', color: colors.text },
  loadingText: { marginTop: 8, color: colors.primary, fontWeight: '600' },
  loadingSub: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  failTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.text },
  failText: { marginTop: 8, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  retryPrimary: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.button,
  },
  retryPrimaryText: { color: colors.white, fontWeight: '600' },
  retryGhost: { marginTop: 12, padding: 10 },
  retryGhostText: { color: colors.primary, fontWeight: '600' },
  header: { backgroundColor: colors.card },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: { flex: 1 },
  h2: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  h2sub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    backgroundColor: colors.primaryLight,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18 },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: '#B45309' },
  errorRetry: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  scroll: { flex: 1 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  timeGrid: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 8 },
  timeCell: { flex: 1 },
  timeLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  timeValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: '#F9FAFB',
  },
  hoursHint: {
    fontSize: 11,
    color: colors.textSecondary,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  noteInput: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  secondaryBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#FAFAFA',
  },
  listText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },
  listSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  listMeta: { fontSize: 11, color: colors.textMuted },
  warnBox: {
    flexDirection: 'row',
    gap: 6,
    margin: 12,
    padding: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.sm,
  },
  warnText: { flex: 1, fontSize: 11, color: '#B45309', lineHeight: 16 },
  empty: { padding: 14, fontSize: 12, color: colors.textMuted },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 12,
    gap: 8,
  },
  ghostFooter: {
    height: 40,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostFooterText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  primaryFooter: {
    height: 48,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFooterText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
