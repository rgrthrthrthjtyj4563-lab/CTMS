import Constants from 'expo-constants';

const DEFAULT_API = 'http://localhost:3001';

/** 真机调试时在 apps/mobile/.env 设置 EXPO_PUBLIC_API_URL=http://<电脑局域网IP>:3001 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl ?? DEFAULT_API).replace(/\/$/, '');
}