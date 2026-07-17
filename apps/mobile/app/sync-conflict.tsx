import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

export default function SyncConflictScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>同步冲突</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.alert}>
          <AlertTriangle size={16} color={colors.amber} />
          <Text style={styles.alertText}>本地版本与服务器版本不一致，请选择保留哪个版本</Text>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>服务器版本</Text>
          <Text style={styles.content}>
            核查知情同意书：共8份，受试者01-08均已签署。
          </Text>
        </Card>

        <Card style={styles.conflictCard}>
          <Text style={styles.sectionTitle}>本地版本</Text>
          <Text style={styles.content}>
            核查知情同意书：共8份，受试者01-08均已签署。受试者06 ICF 日期填写不规范。
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>保留服务器版本</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>保留本地版本</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  alert: { flexDirection: 'row', gap: 8, backgroundColor: colors.amberLight, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: '#FDE68A' },
  alertText: { flex: 1, fontSize: 12, color: '#B45309', lineHeight: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', padding: 14, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  content: { padding: 14, fontSize: typography.base, color: '#374151', lineHeight: 20 },
  conflictCard: { borderColor: '#FECACA' },
  footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight },
  secondary: { flex: 1, height: 44, backgroundColor: '#F3F4F6', borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: typography.base, color: '#374151', fontWeight: '500' },
  primary: { flex: 1, height: 44, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: typography.base, color: colors.white, fontWeight: '600' },
});