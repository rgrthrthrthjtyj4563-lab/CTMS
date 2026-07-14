import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { QuestionnaireItem } from "../lib/api";
import { colors } from "../theme";

interface Props {
  item: QuestionnaireItem;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}

export function EproField({ item, value, onChange, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        {item.prompt}
        {item.required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {item.type === "scale" || item.type === "number" ? (
        <View style={styles.row}>
          <Text style={styles.chip}>{String(value ?? item.min ?? 0)}</Text>
          <View style={styles.scaleRow}>
            {Array.from(
              { length: (item.max ?? 10) - (item.min ?? 0) + 1 },
              (_, i) => (item.min ?? 0) + i,
            ).map((n) => (
              <Pressable
                key={n}
                disabled={disabled}
                onPress={() => onChange(n)}
                style={[styles.scaleBtn, value === n && styles.scaleBtnOn]}
              >
                <Text style={[styles.scaleTxt, value === n && styles.scaleTxtOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : item.type === "text" ? (
        <TextInput
          style={styles.input}
          multiline
          editable={!disabled}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          placeholder="请填写"
          placeholderTextColor={colors.muted}
        />
      ) : item.type === "single" ? (
        <View style={styles.options}>
          {(item.options ?? []).map((opt) => (
            <Pressable
              key={opt}
              disabled={disabled}
              onPress={() => onChange(opt)}
              style={[styles.opt, value === opt && styles.optOn]}
            >
              <Text style={[styles.optTxt, value === opt && styles.optTxtOn]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>暂不支持题型 {item.type}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  prompt: { fontSize: 16, color: colors.text, marginBottom: 10, lineHeight: 22 },
  req: { color: colors.danger },
  row: { gap: 8 },
  chip: { fontSize: 28, fontWeight: "600", color: colors.primary },
  scaleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scaleBtn: {
    minWidth: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  scaleBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  scaleTxt: { color: colors.text, fontSize: 14 },
  scaleTxtOn: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opt: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optTxt: { color: colors.muted, fontSize: 14 },
  optTxtOn: { color: colors.primary, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
});