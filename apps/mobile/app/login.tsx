import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Zap } from 'lucide-react-native';
import { ApiError, api } from '../src/lib/api';
import { saveSession } from '../src/lib/session';
import { StatusBar } from '../src/components/StatusBar';
import { getApiBaseUrl } from '../src/lib/config';
import { colors, radius, typography } from '../src/theme';

const ORGS = [
  { code: 'qm', label: '启明医药CRO' },
  { code: 'aj', label: '安健制药（申办方）' },
  { code: 'hs', label: '华山医学研究SMO' },
];

export default function LoginScreen() {
  const [phone, setPhone] = useState('13800138001');
  const [password, setPassword] = useState('password');
  const [org, setOrg] = useState('qm');
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setBusy(true);
    try {
      const res = await api.login(phone.trim(), password);
      await saveSession({ token: res.token, user: res.user });
      if (['PM', 'QA'].includes(res.user.role)) {
        router.replace('/review');
      } else {
        router.replace('/(tabs)/workbench');
      }
    } catch (e) {
      Alert.alert('登录失败', e instanceof ApiError ? e.message : '请检查网络连接');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <Zap size={21} color={colors.white} strokeWidth={2.2} />
          </View>
          <Text style={styles.h1}>AI临床运营</Text>
          <Text style={styles.sub}>协同平台 · 专业版</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>手机号 / 工号</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>所属组织</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={org} onValueChange={setOrg} style={styles.picker}>
              {ORGS.map((o) => (
                <Picker.Item key={o.code} label={o.label} value={o.code} />
              ))}
            </Picker>
          </View>
        </View>

        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void onLogin()}
          disabled={busy}
        >
          <Text style={styles.btnText}>{busy ? '登录中…' : '登录'}</Text>
        </Pressable>

        <View style={styles.links}>
          <Text style={styles.link}>忘记密码</Text>
          <Text style={styles.link}>扫码登录</Text>
        </View>
      </ScrollView>
        <Text style={styles.footer}>v2.6.1 · API: {getApiBaseUrl()}</Text>
        <Text style={styles.footerHint}>真机请确保手机与电脑同一 Wi-Fi，且 API 已启动</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.card },
  content: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  logo: { marginBottom: 40 },
  logoMark: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  h1: { fontSize: typography.title, fontWeight: '700', color: colors.text },
  sub: { fontSize: typography.base, color: colors.textSecondary, marginTop: 2 },
  field: { marginBottom: 16 },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  pickerWrap: {
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  picker: { height: 44 },
  btn: {
    marginTop: 16,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { fontSize: typography.base, color: colors.primary },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    paddingBottom: 4,
  },
  footerHint: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
    paddingBottom: 40,
  },
});