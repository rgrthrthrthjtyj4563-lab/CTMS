import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, typography } from '../src/theme';

export default function FollowUpScreen() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>跟进函事项草稿</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={styles.hint}>
            {visitId
              ? '跟进事项由动作包中的 FOLLOW_UP_ITEM 确认后写入。请从动作包查看。'
              : '请从动作包或访视详情进入跟进事项。'}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  hint: { padding: 16, fontSize: typography.base, color: colors.textSecondary, lineHeight: 22 },
});