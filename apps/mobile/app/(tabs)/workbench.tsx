import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Building2,
  Bell,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  Zap,
  Info,
  MessageSquare,
  Play,
  Camera,
  CheckCircle2,
  RefreshCw,
  Pencil,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { useSession } from '../../src/hooks/useSession';
import { saveSession, loadToken } from '../../src/lib/session';
import {
  pickPhotoFromCamera,
  pickDocument,
  pickImageFromLibrary,
  detectSensitiveHints,
  type PickedFile,
} from '../../src/lib/media';
import { purposeLabel } from '../../src/lib/photo-purpose';
import { goImvActive, goImvBrief, goVisitSummary, goVoice } from '../../src/lib/navigation';
import { StatusBar } from '../../src/components/StatusBar';
import { BottomNav } from '../../src/components/BottomNav';
import { Tag } from '../../src/components/Tag';
import { Card } from '../../src/components/Card';
import { InputBar } from '../../src/components/InputBar';
import { InputEditModal } from '../../src/components/InputEditModal';
import { PurposePickerModal } from '../../src/components/PurposePickerModal';
import { colors, radius, typography } from '../../src/theme';

type TimelineEntry = { id: string; type: string; content: string; createdAt: string };

const EDITABLE_VISIT = new Set(['IN_PROGRESS', 'PENDING_WRAP_UP', 'PLANNED', 'PM_RETURNED']);

export default function WorkbenchScreen() {
  const { user, refresh: refreshSession } = useSession();
  const [highlights, setHighlights] = useState<
    Array<{ id: string; type: string; title: string; subtitle?: string }>
  >([]);
  const [aiSuggestion, setAiSuggestion] = useState<{ content: string; source: string } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [visitStatus, setVisitStatus] = useState<string | null>(null);
  const [noVisitReason, setNoVisitReason] = useState<string | null>(null);
  const [context, setContext] = useState<{
    projectCode?: string;
    siteName?: string;
    siteCode?: string;
  }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editEntry, setEditEntry] = useState<TimelineEntry | null>(null);
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sourcePicker, setSourcePicker] = useState(false);

  const syncContextToSession = useCallback(async (ctx: {
    projectId?: string;
    projectCode?: string;
    projectName?: string;
    siteId?: string;
    siteName?: string;
    siteCode?: string;
    organizationName?: string;
  }) => {
    const token = await loadToken();
    if (!user || !token) return;
    await saveSession({
      token,
      user: {
        ...user,
        projectId: ctx.projectId,
        projectCode: ctx.projectCode,
        projectName: ctx.projectName,
        siteId: ctx.siteId,
        siteName: ctx.siteName,
        siteCode: ctx.siteCode,
        organizationName: ctx.organizationName ?? user.organizationName,
      },
    });
    await refreshSession();
  }, [user, refreshSession]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.workbench();
      setHighlights(data.highlights);
      setTimeline(data.timeline ?? []);
      setAiSuggestion(data.aiSuggestion ?? null);
      setNoVisitReason(data.noVisitReason ?? null);
      setContext({
        projectCode: data.context.projectCode,
        siteName: data.context.siteName,
        siteCode: data.context.siteCode,
      });

      const active = data.activeVisit;
      const planned = data.plannedVisits[0];
      if (active) {
        setVisitId(active.id);
        setVisitStatus(active.status);
      } else if (planned) {
        setVisitId(planned.id);
        setVisitStatus(planned.status);
      } else {
        setVisitId(null);
        setVisitStatus(null);
      }

      await syncContextToSession(data.context);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [syncContextToSession]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const navigateHighlight = (h: { type: string; id: string }) => {
    if (h.type === 'PLANNED_VISIT') goImvBrief(h.id);
    else if (h.type === 'ACTIVE_VISIT') goImvActive(h.id);
    else if (h.type === 'PENDING_ACTION_PACK') {
      router.push({ pathname: '/action-pack', params: { packId: h.id } });
    } else if (h.type === 'DUE_ISSUE') router.push({ pathname: '/issue/[id]', params: { id: h.id } });
    else if (h.type === 'PM_RETURN') goImvActive(h.id);
    else if (h.type === 'UNCONFIRMED_HOURS') router.push('/(tabs)/hours');
  };

  const badgeFor = (type: string) => {
    if (type === 'PLANNED_VISIT') return <Tag status="pending" label="待开始" />;
    if (type === 'ACTIVE_VISIT') return <Tag status="info" label="进行中" />;
    if (type === 'DUE_ISSUE') return <Tag status="warning" label="截止临近" />;
    if (type === 'PM_RETURN') return <Tag status="risk" label="PM退回" />;
    return <Tag status="draft" label="待操作" />;
  };

  const iconFor = (type: string) => {
    if (type.includes('VISIT')) return <Calendar size={13} color={colors.primary} />;
    if (type === 'DUE_ISSUE') return <AlertCircle size={13} color={colors.amber} />;
    return <FileText size={13} color={colors.sky} />;
  };

  const ensureVisit = (): string | null => {
    if (visitId) return visitId;
    Alert.alert(
      '暂无访视上下文',
      noVisitReason ?? '请先选择或创建今日计划 IMV',
      [
        { text: '切换项目/中心', onPress: () => router.push('/project-select') },
        { text: '知道了', style: 'cancel' },
      ],
    );
    return null;
  };

  const startImv = () => {
    if (!visitId) {
      Alert.alert('暂无访视', noVisitReason ?? '当前项目/中心下没有可用的今日 IMV');
      return;
    }
    if (visitStatus === 'IN_PROGRESS') {
      goImvActive(visitId);
      return;
    }
    goImvBrief(visitId);
  };

  const submitText = async () => {
    const text = inputText.trim();
    if (!text) return;
    const id = ensureVisit();
    if (!id) return;
    setSubmitting(true);
    try {
      await api.addVisitInput(id, { type: 'TEXT', content: text });
      setInputText('');
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/login');
        return;
      }
      Alert.alert('提交失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFile = async (
    file: PickedFile,
    purpose?: string,
    note?: string,
  ) => {
    const id = ensureVisit();
    if (!id) return;
    const hints = detectSensitiveHints(file.name);
    if (hints.length > 0) {
      router.push({
        pathname: '/sensitive-info',
        params: { visitId: id, uri: file.uri, name: file.name, mimeType: file.mimeType ?? '' },
      });
      return;
    }
    setSubmitting(true);
    try {
      const clientAttachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await api.uploadAttachment(id, file, {
        clientAttachmentId,
        purpose,
        note,
      });
      if (res.attachment.sensitiveFlag) {
        router.push({
          pathname: '/sensitive-info',
          params: {
            visitId: id,
            attachmentId: res.attachment.id,
            uri: file.uri,
            name: file.name,
          },
        });
        return;
      }
      const type = file.mimeType?.startsWith('image/') ? 'IMAGE' : 'FILE';
      const purposeText = purposeLabel(purpose ?? res.attachment.purpose);
      await api.addVisitInput(id, {
        type,
        content: `已上传${type === 'IMAGE' ? '照片' : '文件'}：${res.attachment.fileName}（用途：${purposeText}${note ? `；${note}` : ''}）`,
        clientInputId: `input-${clientAttachmentId}`,
      });
      await load();
    } catch (e) {
      Alert.alert('上传失败', e instanceof Error ? e.message : '请重试', [
        { text: '取消', style: 'cancel' },
        { text: '重试', onPress: () => void uploadFile(file, purpose, note) },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const onCamera = () => {
    if (!ensureVisit()) return;
    setSourcePicker(true);
  };

  const pickSource = async (kind: 'camera' | 'library' | 'file') => {
    setSourcePicker(false);
    const file: PickedFile | null =
      kind === 'camera' ? await pickPhotoFromCamera() : kind === 'library' ? await pickImageFromLibrary() : await pickDocument();
    if (!file) return;
    setPendingFile(file);
  };

  const onPickFile = async () => {
    if (!ensureVisit()) return;
    const doc = await pickDocument();
    if (!doc) return;
    setPendingFile(doc);
  };

  const openVoice = () => {
    const id = ensureVisit();
    if (!id) return;
    if (visitStatus && !EDITABLE_VISIT.has(visitStatus)) {
      Alert.alert('无法录音', `当前访视状态为 ${visitStatus}，不可继续录入`);
      return;
    }
    goVoice(id);
  };

  const endVisitFromWorkbench = async () => {
    const id = ensureVisit();
    if (!id) return;
    if (
      visitStatus === 'IN_PROGRESS' ||
      visitStatus === 'PENDING_WRAP_UP' ||
      visitStatus === 'PENDING_CRA_CONFIRM'
    ) {
      if (submitting) return;
      setSubmitting(true);
      try {
        // Fast end only when still in progress; summary page builds pack (idempotent).
        if (visitStatus === 'IN_PROGRESS') {
          await api.endVisit(id);
          setVisitStatus('PENDING_WRAP_UP');
        }
        goVisitSummary(id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/login');
          return;
        }
        // Already ended or other recoverable — still open summary
        if (visitStatus !== 'IN_PROGRESS') {
          goVisitSummary(id);
          return;
        }
        Alert.alert('结束访视失败', e instanceof Error ? e.message : '请重试', [
          { text: '仍进入总结', onPress: () => goVisitSummary(id) },
          { text: '取消', style: 'cancel' },
        ]);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!visitStatus) {
      Alert.alert('访视未开始', '请先开始 IMV 后再结束访视');
      return;
    }
    Alert.alert('当前不可结束', `访视状态为 ${visitStatus}，无需再次结束`);
  };

  const canEditTimeline = visitId && visitStatus && EDITABLE_VISIT.has(visitStatus);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  if (loading && !error && highlights.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>加载工作台…</Text>
      </View>
    );
  }

  if (error && highlights.length === 0 && timeline.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <AlertCircle size={32} color={colors.red} />
        <Text style={styles.errorTitle}>工作台加载失败</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <RefreshCw size={14} color={colors.white} />
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerInner}>
          <Pressable style={styles.ctxBtn} onPress={() => router.push('/project-select')}>
            <Building2 size={12} color={colors.textSecondary} />
            <Text style={styles.ctxOrg} numberOfLines={1}>{user?.organizationName ?? '启明医药CRO'}</Text>
            <Text style={styles.ctxDot}>·</Text>
            <Text style={styles.ctxProject} numberOfLines={1}>
              {context.projectCode ?? user?.projectCode ?? 'AJ-001'}研究
            </Text>
            <ChevronDown size={12} color={colors.textMuted} />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push('/offline-draft')}>
              <Bell size={19} color={colors.textSecondary} strokeWidth={1.7} />
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0] ?? '李'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.meta}>
          <MapPin size={10} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {context.siteName ?? user?.siteName ?? '华山医院'} · {context.siteCode ?? user?.siteCode ?? '中心05'}
          </Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaRole}>{user?.role ?? 'CRA'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>
      </View>

      {error && (
        <Pressable style={styles.errorBanner} onPress={() => void load()}>
          <AlertCircle size={14} color={colors.amber} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <Text style={styles.errorBannerRetry}>重试</Text>
        </Pressable>
      )}

      {noVisitReason && (
        <View style={styles.noVisitBanner}>
          <Info size={14} color={colors.amber} />
          <Text style={styles.noVisitText}>{noVisitReason}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
      >
        <Card style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>今日重点</Text>
            <Text style={styles.sectionCount}>{highlights.length}项</Text>
          </View>
          {highlights.map((h, i) => (
            <Pressable key={h.id} style={[styles.highlightRow, i < highlights.length - 1 && styles.highlightBorder]} onPress={() => navigateHighlight(h)}>
              <View style={styles.highlightIcon}>{iconFor(h.type)}</View>
              <View style={styles.highlightBody}>
                <Text style={styles.highlightTitle} numberOfLines={1}>{h.title}</Text>
                {h.subtitle ? <Text style={styles.highlightSub}>{h.subtitle}</Text> : null}
              </View>
              <View style={styles.highlightRight}>
                {badgeFor(h.type)}
                <ChevronRight size={13} color={colors.border} />
              </View>
            </Pressable>
          ))}
          {highlights.length === 0 && (
            <Text style={styles.empty}>暂无今日重点</Text>
          )}
        </Card>

        {aiSuggestion && (
          <View style={styles.aiSection}>
            <Text style={styles.aiLabel}>AI建议</Text>
            <Card style={styles.aiCard}>
              <View style={styles.aiHead}>
                <Zap size={11} color={colors.primary} />
                <Text style={styles.aiHeadText}>基于项目数据生成</Text>
                <Tag status="draft" label="草稿" />
              </View>
              <Text style={styles.aiContent}>{aiSuggestion.content}</Text>
              <View style={styles.aiSource}>
                <Info size={10} color={colors.textMuted} />
                <Text style={styles.aiSourceText}>来源：{aiSuggestion.source}</Text>
              </View>
            </Card>
          </View>
        )}

        <View style={styles.timelineSection}>
          <Text style={styles.aiLabel}>今日记录</Text>
          {timeline.length === 0 ? (
            <Card style={styles.timelineEmpty}>
              <MessageSquare size={18} color={colors.textMuted} />
              <Text style={styles.timelineTitle}>描述你的工作事实</Text>
              <Text style={styles.timelineSub}>AI 自动整理成监查记录、Issue、工时</Text>
            </Card>
          ) : (
            <Card>
              {timeline.map((entry, i) => (
                <Pressable
                  key={entry.id}
                  style={[styles.timelineRow, i < timeline.length - 1 && styles.timelineBorder]}
                  onPress={() => {
                    if (!canEditTimeline) {
                      Alert.alert('不可编辑', '当前访视状态不允许修改记录');
                      return;
                    }
                    if (entry.content.startsWith('【节点记录')) {
                      Alert.alert('旧版数据', '此为历史「记录节点」文本，可作废后重新录入访视活动。');
                    }
                    setEditEntry(entry);
                  }}
                >
                  <Text style={styles.timelineTime}>
                    {new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <View style={styles.timelineBody}>
                    <View style={styles.timelineMeta}>
                      <Tag status="info" label={entry.type} />
                      {entry.content.startsWith('【节点记录') ? (
                        <Tag status="warning" label="旧版" />
                      ) : null}
                      {canEditTimeline ? <Pencil size={11} color={colors.textMuted} /> : null}
                    </View>
                    <Text style={styles.timelineContent} numberOfLines={3}>
                      {entry.content}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.inputArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          {visitId && (visitStatus === 'PLANNED' || visitStatus === 'IN_PROGRESS') ? (
            <Pressable style={styles.quickPrimary} onPress={startImv} disabled={submitting}>
              <Play size={10} color={colors.white} fill={colors.white} />
              <Text style={styles.quickPrimaryText}>
                {visitStatus === 'IN_PROGRESS' ? '继续 IMV' : '开始 IMV'}
              </Text>
            </Pressable>
          ) : !visitId ? (
            <View style={[styles.quickSecondary, styles.quickDisabled]}>
              <Text style={styles.quickSecondaryText}>
                {noVisitReason ? '无可用 IMV' : '暂无访视'}
              </Text>
            </View>
          ) : null}
          {visitStatus === 'IN_PROGRESS' && (
            <Pressable style={styles.quickSecondary} onPress={onCamera} disabled={submitting}>
              <Camera size={11} color={colors.textSecondary} />
              <Text style={styles.quickSecondaryText}>拍照记录</Text>
            </Pressable>
          )}
          {(visitStatus === 'IN_PROGRESS' ||
            visitStatus === 'PENDING_WRAP_UP' ||
            visitStatus === 'PENDING_CRA_CONFIRM') && (
            <Pressable
              style={styles.quickSecondary}
              onPress={() => void endVisitFromWorkbench()}
              disabled={submitting}
            >
              <CheckCircle2 size={11} color={colors.textSecondary} />
              <Text style={styles.quickSecondaryText}>
                {visitStatus === 'IN_PROGRESS' ? '结束访视' : '查看总结'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
        <InputBar
          placeholder="描述工作事实（文字、语音、照片、文件）…"
          value={inputText}
          onChangeText={setInputText}
          onSubmit={() => void submitText()}
          onCamera={onCamera}
          onAttach={() => void onPickFile()}
          onVoice={openVoice}
          submitting={submitting}
          disabled={!visitId || !canEditTimeline}
        />
      </View>

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

      {/* Source picker for camera / library — Modal not Alert (Web-safe) */}
      {sourcePicker ? (
        <View style={styles.sourceMask}>
          <View style={styles.sourceCard}>
            <Text style={styles.sourceTitle}>添加照片</Text>
            <Pressable style={styles.sourceRow} onPress={() => void pickSource('camera')}>
              <Text style={styles.sourceText}>拍照</Text>
            </Pressable>
            <Pressable style={styles.sourceRow} onPress={() => void pickSource('library')}>
              <Text style={styles.sourceText}>相册</Text>
            </Pressable>
            <Pressable style={styles.sourceCancel} onPress={() => setSourcePicker(false)}>
              <Text style={styles.sourceCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <BottomNav active="workbench" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: colors.textMuted, fontSize: typography.base },
  errorTitle: { marginTop: 12, fontSize: typography.lg, fontWeight: '600', color: colors.text },
  errorMsg: { marginTop: 8, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.button },
  retryText: { color: colors.white, fontWeight: '600' },
  header: { backgroundColor: colors.card },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  ctxBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 230 },
  ctxOrg: { fontSize: 12, fontWeight: '600', color: colors.text },
  ctxDot: { color: colors.border },
  ctxProject: { fontSize: 12, color: colors.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  metaText: { fontSize: 11, color: colors.textMuted },
  metaDot: { color: colors.border },
  metaRole: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' },
  errorBannerText: { flex: 1, fontSize: 12, color: '#B45309' },
  errorBannerRetry: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  noVisitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 10 },
  noVisitText: { flex: 1, fontSize: 12, color: '#B45309' },
  scroll: { flex: 1 },
  section: { marginHorizontal: 16, marginTop: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  sectionTitle: { fontSize: 11.5, fontWeight: '600', color: '#374151', textTransform: 'uppercase' },
  sectionCount: { fontSize: 11, color: colors.textMuted },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  highlightBorder: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  highlightIcon: { width: 28, height: 28, borderRadius: 5, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  highlightBody: { flex: 1 },
  highlightTitle: { fontSize: typography.base, fontWeight: '500', color: colors.text },
  highlightSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  highlightRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { padding: 16, textAlign: 'center', color: colors.textMuted, fontSize: typography.base },
  aiSection: { marginHorizontal: 16, marginTop: 12 },
  aiLabel: { fontSize: typography.xs, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  aiCard: { borderColor: `${colors.primary}40` },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primaryLight, borderBottomWidth: 1, borderBottomColor: `${colors.primary}20` },
  aiHeadText: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.primary },
  aiContent: { padding: 14, fontSize: typography.base, color: '#374151', lineHeight: 20 },
  aiSource: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 12 },
  aiSourceText: { fontSize: 11, color: colors.textMuted },
  timelineSection: { marginHorizontal: 16, marginTop: 16 },
  timelineEmpty: { alignItems: 'center', paddingVertical: 40, borderStyle: 'dashed' },
  timelineTitle: { fontSize: typography.base, color: colors.textSecondary, marginTop: 12 },
  timelineSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  timelineBorder: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  timelineTime: { width: 40, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  timelineBody: { flex: 1, gap: 4 },
  timelineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineContent: { fontSize: 13, color: '#374151', lineHeight: 18 },
  inputArea: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  quickActions: { marginBottom: 10 },
  quickPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  quickPrimaryText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  quickSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  quickSecondaryText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  quickDisabled: { opacity: 0.7 },
  sourceMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
    zIndex: 50,
  },
  sourceCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16 },
  sourceTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  sourceRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sourceText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  sourceCancel: { paddingVertical: 12, alignItems: 'center' },
  sourceCancelText: { color: colors.textSecondary },
});
