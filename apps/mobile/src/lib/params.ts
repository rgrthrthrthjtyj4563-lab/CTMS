/** Expo Router may return string | string[] for the same param on Web. */
export function paramStr(
  value: string | string[] | undefined | null,
  fallback = '',
): string {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value[0] ?? fallback;
  return String(value);
}
