import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, typography } from '../src/theme';

export default function ReportDraftScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>监查报告草稿</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.emptyTitle}>报告草稿在动作包中生成</Text>
        <Text style={styles.emptyText}>
          请从 IMV 结束整理 → 动作包 → REPORT_DRAFT 项查看 AI 生成的报告草稿。本独立页面暂未开放。
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  card: { padding: 20 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22 },
});