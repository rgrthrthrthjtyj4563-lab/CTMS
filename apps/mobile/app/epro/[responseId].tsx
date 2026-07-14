import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { EproField } from "../../src/components/EproField";
import { subjectApi } from "../../src/lib/api";
import { colors } from "../../src/theme";

export default function EproScreen() {
  const { responseId } = useLocalSearchParams<{ responseId: string }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [entryChannel, setEntryChannel] = useState("");
  const [sections, setSections] = useState<
    Array<{ id: string; title: string; items: Parameters<typeof EproField>[0]["item"][] }>
  >([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const readOnly = status === "Submitted" || status === "Reviewed";

  const load = useCallback(async () => {
    if (!responseId) return;
    setLoading(true);
    try {
      const d = await subjectApi.getEpro(responseId);
      setTitle(d.template ? `${d.template.name} v${d.template.version}` : "问卷");
      setStatus(d.response.status);
      setEntryChannel(d.response.entryChannel);
      setSections(d.template?.schema?.sections ?? []);
      setAnswers(d.response.responses ?? {});
    } catch (e) {
      Alert.alert("加载失败", (e as Error).message, [
        { text: "返回", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onSave() {
    if (!responseId) return;
    setBusy(true);
    try {
      await subjectApi.saveEpro(responseId, answers);
      Alert.alert("已保存", "您可以稍后继续填写。");
      await load();
    } catch (e) {
      Alert.alert("保存失败", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!responseId) return;
    Alert.alert("确认提交？", "提交后将以受试者源数据保存，后台不能静默修改。", [
      { text: "取消", style: "cancel" },
      {
        text: "提交",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await subjectApi.submitEpro(responseId, answers);
              Alert.alert("提交成功", "感谢您的填写。", [
                { text: "好的", onPress: () => router.back() },
              ]);
            } catch (e) {
              Alert.alert("提交失败", (e as Error).message);
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {entryChannel === "SubjectSelfReport" ? (
        <Text style={styles.banner}>受试者 App 源数据 · 请按真实情况填写</Text>
      ) : null}

      {sections.map((sec) => (
        <View key={sec.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          {sec.items?.map((item) => (
            <EproField
              key={item.id}
              item={item}
              value={answers[item.id]}
              disabled={readOnly || busy}
              onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
            />
          ))}
        </View>
      ))}

      {!readOnly ? (
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={() => void onSave()} disabled={busy}>
            <Text style={styles.secondaryTxt}>保存草稿</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={() => void onSubmit()} disabled={busy}>
            <Text style={styles.primaryTxt}>{busy ? "处理中…" : "提交问卷"}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.done}>此问卷已提交，如需更改请联系研究协调员。</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8 },
  banner: {
    fontSize: 13,
    color: colors.success,
    backgroundColor: colors.successSoft,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  secondaryTxt: { color: colors.text, fontWeight: "600" },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryTxt: { color: "#fff", fontWeight: "600" },
  done: { textAlign: "center", color: colors.muted, marginTop: 16, lineHeight: 20 },
});