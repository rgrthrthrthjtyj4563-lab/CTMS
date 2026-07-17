import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { loadSession } from '../src/lib/session';
import { colors } from '../src/theme';

export default function Index() {
  useEffect(() => {
    void (async () => {
      const session = await loadSession();
      router.replace(session ? '/(tabs)/workbench' : '/login');
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}