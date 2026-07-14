import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { subjectApi, type TaskItem } from "../../src/lib/api";
import { clearSession } from "../../src/lib/session";
import { colors } from "../../src/theme";

const BUCKET_LABEL: Record<string, string> = {
  overdue: "已逾期",
  today: "今天",
  upcoming: "即将到来",
  completed: "已完成",
};

const STATUS_LABEL: Record<string, string> = {
  Scheduled: "待开始",
  InProgress: "进行中",
  Submitted: "已提交",
  Reviewed: "已审核",
};

function TaskRow({ item, onPress }: { item: TaskItem; onPress?: () => void }) {
  const actionable =
    item.kind === "questionnaire" &&
    (item.status === "Scheduled" || item.status === "InProgress" || item.status === "Late");
  return (
    <Pressable
      style={[styles.task, !actionable && styles.taskMuted]}
      onPress={onPress}
      disabled={!actionable}
    >
      <View style={styles.taskHead}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={styles.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
      </View>
      {item.entryChannel === "SubjectSelfReport" ? (
        <Text style={styles.origin}>受试者 App 源数据</Text>
      ) : item.entryChannel === "AssistedEntry" ? (
        <Text style={styles.originAssisted}>CRC 代录（非自填）</Text>
      ) : null}
      {item.kind !== "questionnaire" ? (
        <Text style={styles.meta}>此版本仅支持在 App 内填写问卷任务</Text>
      ) : null}
    </Pressable>
  );
}

export default function TasksScreen() {
  const [profile, setProfile] = useState<{ code: string; project: string } | null>(null);
  const [grouped, setGrouped] = useState<Record<string, TaskItem[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [me, tasks] = await Promise.all([subjectApi.me(), subjectApi.myTasks()]);
    setProfile({ code: me.subject.subjectCode, project: me.project.name });
    setGrouped(tasks.grouped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => Alert.alert("加载失败", (e as Error).message));
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      Alert.alert("刷新失败", (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function onLogout() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>我的研究</Text>
        <Text style={styles.heroTitle}>{profile?.project ?? "加载中…"}</Text>
        <Text style={styles.heroSub}>受试者编号 {profile?.code ?? "—"}</Text>
        <Text style={styles.originBanner}>数据来源：受试者 App（Subject 通道）</Text>
      </View>

      {(["today", "overdue", "upcoming", "completed"] as const).map((bucket) => {
        const items = grouped[bucket] ?? [];
        if (items.length === 0) return null;
        return (
          <View key={bucket} style={styles.section}>
            <Text style={styles.sectionTitle}>{BUCKET_LABEL[bucket]}</Text>
            {items.map((item) => (
              <TaskRow
                key={`${item.kind}-${item.id}`}
                item={item}
                onPress={
                  item.kind === "questionnaire"
                    ? () => router.push(`/epro/${item.id}`)
                    : undefined
                }
              />
            ))}
          </View>
        );
      })}

      <Pressable style={styles.logout} onPress={() => void onLogout()}>
        <Text style={styles.logoutTxt}>退出登录</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  heroLabel: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  heroTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 4 },
  heroSub: { fontSize: 14, color: colors.muted, marginTop: 4 },
  originBanner: { fontSize: 12, color: colors.success, marginTop: 10 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.muted, marginBottom: 8 },
  task: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskMuted: { opacity: 0.85 },
  taskHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  badge: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  origin: { fontSize: 11, color: colors.success, marginTop: 6 },
  originAssisted: { fontSize: 11, color: colors.warning, marginTop: 6 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 6 },
  logout: { alignItems: "center", marginTop: 12, padding: 12 },
  logoutTxt: { color: colors.muted, fontSize: 14 },
});