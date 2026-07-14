import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { subjectApi } from "../../src/lib/api";
import { colors } from "../../src/theme";

const SEVERITY_OPTIONS = [
  { value: "Low", label: "轻度" },
  { value: "Medium", label: "中度" },
  { value: "High", label: "较重" },
  { value: "Critical", label: "严重" },
] as const;

export default function SymptomScreen() {
  const [discomfortType, setDiscomfortType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("Medium");
  const [soughtMedicalCare, setSoughtMedicalCare] = useState(false);
  const [hospitalized, setHospitalized] = useState(false);
  const [stoppedMedication, setStoppedMedication] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!discomfortType.trim() || !description.trim()) {
      Alert.alert("请填写完整", "不适类型和描述为必填项。");
      return;
    }
    setBusy(true);
    try {
      const res = await subjectApi.submitSymptom({
        discomfortType: discomfortType.trim(),
        description: description.trim(),
        severity,
        onsetAt: new Date().toISOString(),
        soughtMedicalCare,
        hospitalized,
        stoppedMedication,
      });
      let msg = "您的症状已上报给研究团队。";
      if (res.severe && res.urgentCareGuidance) {
        msg = `${res.urgentCareGuidance}\n\n${msg}`;
      }
      Alert.alert(res.severe ? "请留意身体状况" : "上报成功", msg);
      setDiscomfortType("");
      setDescription("");
      setSeverity("Medium");
      setSoughtMedicalCare(false);
      setHospitalized(false);
      setStoppedMedication(false);
    } catch (e) {
      Alert.alert("上报失败", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        如感到不适，请如实填写。研究团队会跟进，但这不能替代紧急医疗服务。
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>不适类型</Text>
        <TextInput
          style={styles.input}
          value={discomfortType}
          onChangeText={setDiscomfortType}
          placeholder="例如：发热、恶心、头痛"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>严重程度</Text>
        <View style={styles.chips}>
          {SEVERITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setSeverity(opt.value)}
              style={[styles.chip, severity === opt.value && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, severity === opt.value && styles.chipTxtOn]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>详细描述</Text>
        <TextInput
          style={[styles.input, styles.area]}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="请描述开始时间、持续时间、是否影响日常活动等"
          placeholderTextColor={colors.muted}
        />

        <Row
          label="是否已就医"
          value={soughtMedicalCare}
          onChange={setSoughtMedicalCare}
        />
        <Row label="是否住院" value={hospitalized} onChange={setHospitalized} />
        <Row
          label="是否停药"
          value={stoppedMedication}
          onChange={setStoppedMedication}
        />
      </View>

      {(hospitalized || soughtMedicalCare || severity === "High" || severity === "Critical") ? (
        <Text style={styles.warn}>
          若情况紧急，请立即拨打急救电话或前往急诊科。系统上报用于研究随访协调。
        </Text>
      ) : null}

      <Pressable style={[styles.btn, busy && styles.btnOff]} onPress={() => void onSubmit()} disabled={busy}>
        <Text style={styles.btnTxt}>{busy ? "提交中…" : "提交症状上报"}</Text>
      </Pressable>
      <Text style={styles.footer}>数据将标记为受试者 App 源数据</Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  lead: { fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  area: { minHeight: 100, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipTxt: { color: colors.muted, fontSize: 14 },
  chipTxtOn: { color: colors.primary, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 15, color: colors.text },
  warn: {
    marginTop: 14,
    fontSize: 13,
    color: colors.danger,
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 10,
    lineHeight: 20,
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footer: { textAlign: "center", marginTop: 12, fontSize: 12, color: colors.success },
});