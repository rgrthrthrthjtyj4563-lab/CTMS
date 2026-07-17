import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Play, AlertTriangle } from 'lucide-react-native';
import { api } from '../src/lib/api';
import { StatusBar } from '../src/components/StatusBar';
import { Tag } from '../src/components/Tag';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

interface BriefData {
  visit: {
    id: string;
    type: string;
    status: string;
    plannedDate: string;
    project: { code: string; name: string };
    site: { code: string; name: string };
  };
  enrollmentSummary?: { enrolled: number | null; target: number | null; screened: number | null; note?: string };
  openIssues: Array<{ id: string; title: string; targetDate?: string; responsiblePerson?: string }>;
  focusAreas: string[];
}

export default function IMVBriefScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!visitId) return;
      setLoading(true);
      setError(null);
      void api
        .visitBrief(visitId)
        .then((r) => setBrief(r.brief as unknown as BriefData))
        .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
        .finally(() => setLoading(false));
    }, [visitId]),
  );

  const start = async () => {
    if (!visitId) return;
    try {
      await api.startVisit(visitId);
      router.push(`/imv-active?visitId=${visitId}`);
    } catch (e) {
      Alert.alert('无法开始', e instanceof Error ? e.message : '请重试');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !brief) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? '简报加载失败'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const v = brief.visit;
  const enrolled = brief.enrollmentSummary?.enrolled;
  const target = brief.enrollmentSummary?.target;
  const hasEnrollment = enrolled != null && target != null && target > 0;
  const pct = hasEnrollment ? Math.round((enrolled / target) * 100) : 0;
  const plannedDate = new Date(v.plannedDate).toLocaleDateString('zh-CN');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={1.8} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.h2}>访视前简报</Text>
            <Text style={styles.h2sub}>{v.type} · {v.site.name} {v.site.code}</Text>
          </View>
          <Pressable style={styles.startBtn} onPress={() => void start()}>
            <Play size={12} color={colors.white} fill={colors.white} />
            <Text style={styles.startText}>{v.status === 'IN_PROGRESS' ? '继续' : '开始'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={styles.cardLabel}>访视信息</Text>
          {[
            ['访视类型', v.type],
            ['研究项目', `${v.project.code} · ${v.project.name}`],
            ['研究中心', `${v.site.name} ${v.site.code}`],
            ['计划日期', plannedDate],
            ['当前状态', v.status],
          ].map(([k, val], i, arr) => (
            <View key={k} style={[styles.kvRow, i < arr.length - 1 && styles.kvBorder]}>
              <Text style={styles.kvKey}>{k}</Text>
              <Text style={styles.kvVal}>{val}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.cardLabel}>入组概况</Text>
          {hasEnrollment ? (
            <View style={styles.enrollBody}>
              <View style={styles.enrollTop}>
                <Text style={styles.enrollNum}>{enrolled}</Text>
                <Text style={styles.enrollSub}>/ {target} 名在研</Text>
                <Text style={styles.enrollGap}>差{target - enrolled}名达标</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            </View>
          ) : (
            <Text style={styles.noData}>
              {brief.enrollmentSummary?.note ?? '暂无入组数据（V1 不提供受试者访视管理）'}
            </Text>
          )}
        </Card>

        {brief.openIssues.length > 0 && (
          <Card style={styles.issueCard}>
            <View style={styles.issueHead}>
              <AlertTriangle size={12} color={colors.amber} />
              <Text style={styles.issueHeadText}>上次遗留 Issue（{brief.openIssues.length}条未关闭）</Text>
            </View>
            {brief.openIssues.map((issue, i) => (
              <Pressable
                key={issue.id}
                style={[styles.issueRow, i < brief.openIssues.length - 1 && styles.issueBorder]}
                onPress={() => router.push(`/issue/${issue.id}`)}
              >
                <Text style={styles.issueCode}>IS-{issue.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.issueMeta}>
                  {issue.responsiblePerson ? `负责人：${issue.responsiblePerson}` : ''}
                  {issue.targetDate ? ` · 截止 ${issue.targetDate.split('T')[0]}` : ''}
                </Text>
                <Tag status="pending" label="跟进中" />
              </Pressable>
            ))}
          </Card>
        )}

        <Card>
          <Text style={styles.cardLabel}>本次访视重点</Text>
          <View style={styles.focusBody}>
            {brief.focusAreas.map((item) => (
              <View key={item} style={styles.focusRow}>
                <View style={styles.focusCheck} />
                <Text style={styles.focusText}>{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  errorText: { color: colors.red, marginBottom: 12 },
  backLink: { color: colors.primary, fontWeight: '600' },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { flex: 1 },
  h2: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  h2sub: { fontSize: 11, color: colors.textSecondary },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 8 },
  startText: { color: colors.white, fontSize: typography.base, fontWeight: '600' },
  scroll: { flex: 1 },
  cardLabel: { fontSize: 11.5, fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  kvRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  kvBorder: { borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  kvKey: { width: 76, fontSize: 11.5, color: colors.textMuted },
  kvVal: { flex: 1, fontSize: typography.base, fontWeight: '500', color: colors.text },
  enrollBody: { padding: 16 },
  enrollTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  enrollNum: { fontSize: 28, fontWeight: '700', color: colors.text },
  enrollSub: { fontSize: typography.base, color: colors.textSecondary, marginBottom: 2 },
  enrollGap: { marginLeft: 'auto', fontSize: 12, color: colors.amber, fontWeight: '600', marginBottom: 2 },
  progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  noData: { padding: 16, fontSize: typography.base, color: colors.textMuted },
  issueCard: { borderColor: '#FDE68A' },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FEF3C7' },
  issueHeadText: { fontSize: 11.5, fontWeight: '600', color: '#B45309' },
  issueRow: { padding: 14 },
  issueBorder: { borderBottomWidth: 1, borderBottomColor: '#FFFBEB' },
  issueCode: { fontSize: typography.xs, color: colors.textMuted, fontFamily: 'monospace' },
  issueTitle: { fontSize: typography.base, fontWeight: '500', color: colors.text, marginTop: 2 },
  issueMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 4, marginBottom: 6 },
  focusBody: { padding: 14, gap: 10 },
  focusRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  focusCheck: { width: 15, height: 15, borderRadius: 3, borderWidth: 2, borderColor: '#D1D5DB', marginTop: 2 },
  focusText: { flex: 1, fontSize: typography.base, color: '#374151', lineHeight: 20 },
});