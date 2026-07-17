import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Square,
  CheckSquare,
  AlertTriangle,
  ClipboardList,
  Pencil,
  Sparkles,
} from 'lucide-react-native';
import { api, ApiError } from '../src/lib/api';
import {
  pickPhotoFromCamera,
  pickDocument,
  pickImageFromLibrary,
  detectSensitiveHints,
  type PickedFile,
} from '../src/lib/media';
import { purposeLabel } from '../src/lib/photo-purpose';
import { goVisitSummary, goVoice } from '../src/lib/navigation';
import { paramStr } from '../src/lib/params';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { InputBar } from '../src/components/InputBar';
import { InputEditModal } from '../src/components/InputEditModal';
import { PurposePickerModal } from '../src/components/PurposePickerModal';
import { colors, radius } from '../src/theme';

type Activity = {
  id: string;
  activityType: string;
  title: string;
  status: string;
  note?: string | null;
};

/** AI pipeline status for field inputs (not formal records yet). */
type ProcessStatus = 'recorded' | 'pending_ai' | 'in_pack' | 'failed' | 'voided';

type Entry = {
  id: string;
  time: string;
  content: string;
  risk: boolean;
  process: ProcessStatus;
  type?: string;
};

function processLabel(p: ProcessStatus): string {
  switch (p) {
    case 'recorded':
      return '已记录';
    case 'pending_ai':
      return '待 AI 整理';
    case 'in_pack':
      return '已纳入行动包';
    case 'failed':
      return '整理失败，可重试';
    case 'voided':
      return '已作废';
    default:
      return '已记录';
  }
}

function processColor(p: ProcessStatus): string {
  switch (p) {
    case 'pending_ai':
      return colors.amber;
    case 'in_pack':
      return colors.primary;
    case 'failed':
      return colors.red;
    case 'voided':
      return colors.textMuted;
    default:
      return colors.textSecondary;
  }
}

function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分钟`;
}

export default function IMVActiveScreen() {
  const rawParams = useLocalSearchParams<{
    visitId?: string | string[];
    voiceDone?: string | string[];
  }>();
  const visitId = paramStr(rawParams.visitId);
  const voiceDoneFlag = paramStr(rawParams.voiceDone);
  const [visitMeta, setVisitMeta] = useState<{
    projectCode: string;
    siteName: string;
    siteCode: string;
    status: string;
    actualStartTime?: string;
    actualEndTime?: string | null;
    durationMinutes?: number | null;
  } | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivities, setShowActivities] = useState(true);
  const [voiceBanner, setVoiceBanner] = useState(false);
  const [hasActionPack, setHasActionPack] = useState(false);

  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sourcePicker, setSourcePicker] = useState(false);

  const load = useCallback(async () => {
    if (!visitId) return;
    setError(null);
    try {
      const d = await api.visitDetail(visitId);
      const start = d.visit.actualStartTime
        ? new Date(d.visit.actualStartTime).getTime()
        : Date.now();
      const durationMinutes =
        d.visit.durationMinutes ?? Math.round((Date.now() - start) / 60000);

      const status = d.visit.status;
      // Pack is created during wrap-up complete; statuses after PENDING_WRAP_UP imply pack path done.
      const packExists = ![
        'PLANNED',
        'IN_PROGRESS',
        'PENDING_WRAP_UP',
        'CANCELLED',
      ].includes(status);
      setHasActionPack(packExists);
      setVisitMeta({
        projectCode: d.visit.project.code,
        siteName: d.visit.site.name,
        siteCode: d.visit.site.code,
        status,
        actualStartTime: d.visit.actualStartTime,
        actualEndTime: d.visit.actualEndTime,
        durationMinutes,
      });

      setEntries(
        d.visit.inputs
          .filter((row) => !row.isVoided)
          .map((row) => {
            const voided = Boolean(row.isVoided) || row.status === 'VOIDED';
            let process: ProcessStatus = 'pending_ai';
            if (voided) process = 'voided';
            else if (packExists) process = 'in_pack';
            else process = 'pending_ai';
            return {
              id: row.id,
              time: new Date(row.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              content: row.transcript || row.content,
              risk: /发现|未签字|缺失|⚑|AE|SAE/.test(row.content),
              process,
              type: row.type,
            };
          }),
      );

      try {
        const act = await api.visitActivities(visitId);
        setActivities(act.activities);
      } catch {
        setActivities([]);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '加载失败';
      setError(msg);
    }
  }, [visitId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (voiceDoneFlag === '1') {
        setVoiceBanner(true);
        // clear query flag so banner only shows once
        router.setParams({ voiceDone: undefined });
      }
    }, [load, voiceDoneFlag]),
  );

  const submitInput = async () => {
    if (!visitId || !input.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.addVisitInput(visitId, {
        type: 'TEXT',
        content: input.trim(),
        clientInputId: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setInput('');
      await load();
    } catch (e) {
      Alert.alert('发送失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFile = async (file: PickedFile, purpose?: string, note?: string) => {
    if (!visitId || submitting) return;
    const hints = detectSensitiveHints(file.name);
    if (hints.length > 0) {
      router.push({
        pathname: '/sensitive-info',
        params: { visitId, uri: file.uri, name: file.name, mimeType: file.mimeType ?? '' },
      });
      return;
    }
    setSubmitting(true);
    try {
      const clientAttachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await api.uploadAttachment(visitId, file, {
        clientAttachmentId,
        purpose,
        note,
      });
      if (res.attachment.sensitiveFlag) {
        router.push({
          pathname: '/sensitive-info',
          params: {
            visitId,
            attachmentId: res.attachment.id,
            uri: file.uri,
            name: file.name,
          },
        });
        return;
      }
      const purposeText = purposeLabel(purpose ?? res.attachment.purpose);
      const type = file.mimeType?.startsWith('image/') ? 'IMAGE' : 'FILE';
      await api.addVisitInput(visitId, {
        type,
        content: `已上传${type === 'IMAGE' ? '照片' : '文件'}：${res.attachment.fileName}（用途：${purposeText}${note ? `；${note}` : ''}）`,
        clientInputId: `input-${clientAttachmentId}`,
      });
      await load();
    } catch (e) {
      Alert.alert('上传失败', e instanceof Error ? e.message : '请检查网络后重试', [
        { text: '取消', style: 'cancel' },
        { text: '重试', onPress: () => void uploadFile(file, purpose, note) },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const onCamera = () => setSourcePicker(true);

  const pickSource = async (kind: 'camera' | 'library') => {
    setSourcePicker(false);
    const file =
      kind === 'camera' ? await pickPhotoFromCamera() : await pickImageFromLibrary();
    if (!file) return;
    setPendingFile(file);
  };

  const onPickFile = async () => {
    const doc = await pickDocument();
    if (!doc) return;
    setPendingFile(doc);
  };

  const toggleActivity = async (activity: Activity) => {
    if (!visitId || busy) return;
    const next = activity.status === 'DONE' ? 'PENDING' : 'DONE';
    try {
      await api.updateVisitActivity(visitId, activity.id, { status: next });
      setActivities((prev) =>
        prev.map((a) => (a.id === activity.id ? { ...a, status: next } : a)),
      );
    } catch (e) {
      Alert.alert('更新失败', e instanceof Error ? e.message : '请重试');
    }
  };

  const openEdit = (entry: Entry) => setEditEntry(entry);

  const endVisit = async () => {
    if (!visitId || busy) return;
    setBusy(true);
    try {
      // Mark ended quickly; summary page runs staged AI pack generation.
      if (visitMeta?.status === 'IN_PROGRESS' || !visitMeta?.status) {
        await api.endVisit(visitId);
      }
      goVisitSummary(visitId);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '结束失败';
      if (
        code === 'INVALID_STATUS' ||
        /未在进行中|已经结束|幂等|PENDING_WRAP/i.test(msg)
      ) {
        goVisitSummary(visitId);
      } else {
        try {
          const res = await api.completeVisit(visitId);
          goVisitSummary(visitId, res.actionPack?.id ?? null);
        } catch (e2) {
          const msg2 =
            e2 instanceof ApiError ? e2.message : e2 instanceof Error ? e2.message : msg;
          Alert.alert('结束访视失败', msg2, [
            {
              text: '仍进入整理',
              onPress: () => goVisitSummary(visitId),
            },
            { text: '取消', style: 'cancel' },
          ]);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const startLabel = visitMeta?.actualStartTime
    ? new Date(visitMeta.actualStartTime).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const isEnded = visitMeta && !['PLANNED', 'IN_PROGRESS'].includes(visitMeta.status);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <StatusBar dark />
        <View style={styles.topContent}>
          <View style={styles.topLeft}>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, isEnded && styles.liveDotEnded]} />
              <Text style={styles.liveText}>{isEnded ? '访视已结束' : '访视进行中'}</Text>
            </View>
            <Text style={styles.visitTitle}>
              IMV · {visitMeta?.siteName ?? '—'} {visitMeta?.siteCode ?? ''}
            </Text>
            <Text style={styles.visitSub}>
              {visitMeta?.projectCode ?? '—'} · {startLabel} 开始
              {visitMeta?.actualEndTime
                ? ` · ${new Date(visitMeta.actualEndTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} 结束`
                : ''}
            </Text>
          </View>
          <View style={styles.timer}>
            <Text style={styles.timerValue}>
              {formatDurationMinutes(visitMeta?.durationMinutes)}
            </Text>
            <Text style={styles.timerLabel}>总时长</Text>
          </View>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.ghostBtn} onPress={() => setShowActivities((v) => !v)}>
            <ClipboardList size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.ghostText}>
              访视活动
              {activities.length
                ? ` ${activities.filter((a) => a.status === 'DONE').length}/${activities.length}`
                : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.endBtn, busy && styles.endBtnDisabled]}
            onPress={() => void endVisit()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Square size={10} color={colors.white} fill={colors.white} />
            )}
            <Text style={styles.endText}>
              {busy
                ? '结束中…'
                : isEnded
                  ? hasActionPack
                    ? '查看 AI 整理'
                    : '进入整理'
                  : '结束访视并整理'}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Pressable style={styles.errorBanner} onPress={() => void load()}>
          <AlertTriangle size={14} color={colors.amber} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>重试</Text>
        </Pressable>
      ) : null}

      {voiceBanner ? (
        <Pressable style={styles.voiceBanner} onPress={() => setVoiceBanner(false)}>
          <Sparkles size={14} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceBannerTitle}>录音已转写，已加入本次访视素材</Text>
            <Text style={styles.voiceBannerSub}>
              结束访视后将自动整理为 Issue、任务、工时和报告草稿（候选，须人工确认）
            </Text>
          </View>
          <Text style={styles.voiceBannerDismiss}>知道了</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Card borderColor={`${colors.primary}40`}>
          <View style={styles.valueRow}>
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.valueText}>
              现场输入是「素材」不是正式记录。结束访视时 AI 会拆成 Issue / 任务 / 工时 /
              报告草稿等候选，供你确认后提交。
            </Text>
          </View>
        </Card>

        {showActivities && activities.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>访视活动清单</Text>
            {activities.map((a) => {
              const done = a.status === 'DONE';
              return (
                <Pressable
                  key={a.id}
                  style={styles.activityRow}
                  onPress={() => void toggleActivity(a)}
                >
                  {done ? (
                    <CheckSquare size={16} color={colors.primary} />
                  ) : (
                    <View style={styles.checkbox} />
                  )}
                  <Text style={[styles.activityTitle, done && styles.activityDone]}>{a.title}</Text>
                  <Text style={styles.activityStatus}>{done ? '已完成' : '待完成'}</Text>
                </Pressable>
              );
            })}
          </Card>
        )}

        <Text style={styles.feedTitle}>现场素材 · {entries.length} 条</Text>

        {entries.map((entry) => (
          <Card key={entry.id} borderColor={entry.risk ? '#FECACA' : undefined}>
            <Pressable
              style={styles.entryRow}
              onLongPress={() => !isEnded && openEdit(entry)}
              onPress={() => !isEnded && openEdit(entry)}
            >
              <View style={styles.entryTime}>
                <Text style={styles.timeText}>{entry.time}</Text>
                {entry.risk && <AlertTriangle size={11} color={colors.red} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.entryContent}>{entry.content}</Text>
                <Text style={[styles.processTag, { color: processColor(entry.process) }]}>
                  {processLabel(entry.process)}
                  {entry.type === 'VOICE' ? ' · 语音' : entry.type === 'IMAGE' ? ' · 照片' : entry.type === 'FILE' ? ' · 文件' : ''}
                </Text>
              </View>
              {!isEnded && <Pencil size={12} color={colors.textMuted} />}
            </Pressable>
          </Card>
        ))}
        <Text style={styles.hint}>
          {isEnded
            ? hasActionPack
              ? '访视已结束，可进入 AI 行动包逐项确认'
              : '访视已结束，点「进入整理」生成候选动作包'
            : '点按记录可编辑或作废 · 点「结束访视并整理」才会启动 AI 拆分 Issue/任务/工时/报告'}
        </Text>
      </ScrollView>

      {!isEnded && (
        <View style={styles.inputArea}>
          <InputBar
            placeholder="继续描述发现…"
            value={input}
            onChangeText={setInput}
            onSubmit={() => void submitInput()}
            onCamera={() => void onCamera()}
            onAttach={() => void onPickFile()}
            onVoice={() => visitId && goVoice(visitId)}
            submitting={submitting}
          />
        </View>
      )}

      <InputEditModal
        visible={!!editEntry}
        initialContent={editEntry?.content ?? ''}
        onClose={() => setEditEntry(null)}
        onSave={async (content, reason) => {
          if (!visitId || !editEntry) return;
          await api.updateVisitInput(visitId, editEntry.id, content, reason);
          await load();
        }}
        onVoid={async (reason) => {
          if (!visitId || !editEntry) return;
          await api.voidVisitInput(visitId, editEntry.id, reason);
          await load();
        }}
      />

      <PurposePickerModal
        visible={!!pendingFile}
        onCancel={() => setPendingFile(null)}
        onSelect={(purpose, note) => {
          const file = pendingFile;
          setPendingFile(null);
          if (file) void uploadFile(file, purpose, note);
        }}
      />

      {sourcePicker ? (
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>添加照片</Text>
            <Pressable style={styles.sourceRow} onPress={() => void pickSource('camera')}>
              <Text style={styles.sourceText}>拍照</Text>
            </Pressable>
            <Pressable style={styles.sourceRow} onPress={() => void pickSource('library')}>
              <Text style={styles.sourceText}>相册</Text>
            </Pressable>
            <Pressable onPress={() => setSourcePicker(false)}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { backgroundColor: colors.dark },
  topContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topLeft: { flex: 1 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  liveDotEnded: { backgroundColor: '#9CA3AF' },
  liveText: { fontSize: 11, color: '#34D399', fontWeight: '600', letterSpacing: 2 },
  visitTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  visitSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  timer: { alignItems: 'flex-end', maxWidth: 120 },
  timerValue: { fontSize: 15, fontWeight: '700', color: colors.white, textAlign: 'right' },
  timerLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ghostText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  endBtnDisabled: { opacity: 0.7 },
  endText: { fontSize: 12, color: colors.white, fontWeight: '600' },
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
  voiceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.primary}25`,
  },
  voiceBannerTitle: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  voiceBannerSub: { fontSize: 11, color: colors.primary, marginTop: 2, lineHeight: 16, opacity: 0.9 },
  voiceBannerDismiss: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  valueRow: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
  valueText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18 },
  feedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 2,
  },
  processTag: { fontSize: 11, fontWeight: '600' },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#FAFAFA',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  activityTitle: { flex: 1, fontSize: 13, color: colors.text },
  activityDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  activityStatus: { fontSize: 11, color: colors.textMuted },
  entryRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  entryTime: { alignItems: 'center', gap: 4, width: 36 },
  timeText: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  entryContent: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  hint: { textAlign: 'center', fontSize: 11, color: colors.textMuted, paddingVertical: 8 },
  inputArea: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 12,
  },
  modalMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  modalCancelText: { color: colors.textSecondary, fontWeight: '500', textAlign: 'center', paddingVertical: 12 },
  sourceRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sourceText: { fontSize: 15, color: colors.text, fontWeight: '500' },
});
