import { Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ExpoStatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="imv-brief" />
        <Stack.Screen name="imv-active" />
        <Stack.Screen name="visit-summary" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="action-pack" />
        <Stack.Screen name="action-edit" />
        <Stack.Screen name="confirm" />
        <Stack.Screen name="review" />
        <Stack.Screen name="project-select" />
        <Stack.Screen name="sensitive-info" />
        <Stack.Screen name="offline-draft" />
        <Stack.Screen name="sync-conflict" />
        <Stack.Screen name="report-draft" />
        <Stack.Screen name="follow-up" />
        <Stack.Screen name="ai-followup" />
        <Stack.Screen name="issue/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}