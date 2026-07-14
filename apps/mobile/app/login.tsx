import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { ApiError, login } from "../src/lib/api";
import { saveSession } from "../src/lib/session";
import { colors } from "../src/theme";

const DEMO_EMAIL = "subject-a@aic-dct.test";

export default function LoginScreen() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("1234");
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setBusy(true);
    try {
      const { session } = await login(email.trim(), password);
      if (session.role !== "Subject") {
        Alert.alert("仅支持受试者账号", "请使用 subject-a@aic-dct.test 等受试者账号登录。");
        return;
      }
      await saveSession(session);
      router.replace("/(tabs)/tasks");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "登录失败";
      Alert.alert("登录失败", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>AIC-DCT</Text>
        <Text style={styles.title}>受试者端</Text>
        <Text style={styles.sub}>
          您填写的数据将标记为受试者源数据（Subject 通道），与 CRC 代录分开保存。
        </Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="邮箱"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="密码（开发态 ≥4 位）"
          placeholderTextColor={colors.muted}
        />
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void onLogin()}
          disabled={busy}
        >
          <Text style={styles.btnTxt}>{busy ? "登录中…" : "进入我的研究"}</Text>
        </Pressable>
        <Text style={styles.hint}>演示账号：subject-a@aic-dct.test / 1234</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: { fontSize: 13, color: colors.primary, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 20, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: "center" },
});