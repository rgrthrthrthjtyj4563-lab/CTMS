import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Zap } from 'lucide-react-native';
import { StatusBar } from '../src/components/StatusBar';
import { colors, radius, typography } from '../src/theme';

export default function AiFollowupScreen() {
  const { question } = useLocalSearchParams<{ question?: string }>();

  const dismiss = (answer: string) => {
    Alert.alert('已记录', answer);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.titleRow}>
            <Zap size={14} color={colors.primary} />
            <Text style={styles.title}>AI 补充追问</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.question}>
          {question ?? '请补充本次访视中未明确说明的业务事实。'}
        </Text>
        <Text style={styles.hint}>
          您的回答将用于完善动作包。偏差记录创建功能暂未开放。
        </Text>

        <Pressable style={styles.secondary} onPress={() => dismiss('稍后补充')}>
          <Text style={styles.secondaryText}>不确定 / 稍后补充</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={() => dismiss('当日无相关操作')}>
          <Text style={styles.primaryText}>当日无操作</Text>
        </Pressable>
        <Pressable style={[styles.outline, { opacity: 0.5 }]} disabled>
          <Text style={styles.outlineText}>创建偏差记录（暂未开放）</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  body: { flex: 1, padding: 20, gap: 12 },
  question: { fontSize: typography.lg, fontWeight: '600', color: colors.text, lineHeight: 24 },
  hint: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  primary: { height: 48, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  outline: { height: 48, backgroundColor: colors.primaryLight, borderRadius: radius.button, borderWidth: 1, borderColor: `${colors.primary}40`, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  secondary: { height: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textMuted, fontSize: typography.base },
});