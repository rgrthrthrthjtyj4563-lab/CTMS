import Constants from "expo-constants";

/** Override with EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:4000 on device). */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}