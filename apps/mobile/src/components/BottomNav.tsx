import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Home, ClipboardList, User } from 'lucide-react-native';
import { colors, typography } from '../theme';

type TabKey = 'workbench' | 'todo' | 'mine';

const TABS: Array<{ key: TabKey; label: string; path: string; Icon: typeof Home }> = [
  { key: 'workbench', label: '工作台', path: '/(tabs)/workbench', Icon: Home },
  { key: 'todo', label: '待办', path: '/(tabs)/todo', Icon: ClipboardList },
  { key: 'mine', label: '我的', path: '/(tabs)/hours', Icon: User },
];

interface BottomNavProps {
  active?: TabKey;
}

export function BottomNav({ active }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const current: TabKey =
    active ??
    (pathname.includes('/todo') ? 'todo' : pathname.includes('/hours') ? 'mine' : 'workbench');

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      {TABS.map(({ key, label, path, Icon }) => {
        const on = current === key;
        return (
          <Pressable key={key} style={styles.tab} onPress={() => router.push(path as never)}>
            <Icon size={21} color={on ? colors.primary : colors.textMuted} strokeWidth={on ? 2.2 : 1.6} />
            <Text style={[styles.label, on && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12, gap: 3 },
  label: { fontSize: typography.xs, fontWeight: '500', color: colors.textMuted },
  labelActive: { color: colors.primary },
});