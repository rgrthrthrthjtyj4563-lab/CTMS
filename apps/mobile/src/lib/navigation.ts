import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { paramStr } from './params';

/**
 * Navigate to visit summary after end-visit.
 * Expo Router Web often ignores replace/push object form without throwing —
 * try multiple strategies and always leave a manual fallback.
 */
export function goVisitSummary(visitId: string | string[], packId?: string | null) {
  const vid = paramStr(visitId);
  const pid = packId ? paramStr(packId) : '';
  if (!vid) {
    Alert.alert('无法进入总结', '缺少 visitId');
    return;
  }

  const params: Record<string, string> = { visitId: vid };
  if (pid) params.packId = pid;

  // Strategy 1: object form (native + modern expo-router)
  try {
    router.replace({ pathname: '/visit-summary', params });
  } catch {
    /* continue */
  }

  // Strategy 2: href string (more reliable on some Web builds)
  try {
    const qs = new URLSearchParams(params).toString();
    router.replace(`/visit-summary?${qs}` as `/visit-summary`);
  } catch {
    /* continue */
  }

  // Strategy 3: push if replace no-op
  try {
    router.push({ pathname: '/visit-summary', params });
  } catch {
    /* continue */
  }

  // Strategy 4: delayed retry (Web race after long await)
  setTimeout(() => {
    try {
      const qs = new URLSearchParams(params).toString();
      router.replace(`/visit-summary?${qs}` as `/visit-summary`);
    } catch {
      /* ignore */
    }
  }, 50);

  setTimeout(() => {
    try {
      router.push({ pathname: '/visit-summary', params });
    } catch {
      Alert.alert(
        '访视已结束',
        '页面未能自动跳转。请点「进入总结」继续。',
        [
          {
            text: '进入总结',
            onPress: () => {
              const qs = new URLSearchParams(params).toString();
              router.replace(`/visit-summary?${qs}` as `/visit-summary`);
            },
          },
        ],
      );
    }
  }, 400);
}

export function goActionPack(packId: string, mode?: 'review' | 'confirm') {
  const id = paramStr(packId);
  router.push({
    pathname: '/action-pack',
    params: { packId: id, ...(mode ? { mode } : {}) },
  });
}

export function goConfirm(packId: string) {
  router.push({ pathname: '/confirm', params: { packId: paramStr(packId) } });
}

export function goImvActive(visitId: string) {
  router.push({ pathname: '/imv-active', params: { visitId: paramStr(visitId) } });
}

export function goImvBrief(visitId: string) {
  router.push({ pathname: '/imv-brief', params: { visitId: paramStr(visitId) } });
}

export function goReview() {
  router.push('/review');
}

export function goIssue(issueId: string) {
  router.push({ pathname: '/issue/[id]', params: { id: paramStr(issueId) } });
}

export function goVoice(visitId: string) {
  router.push({ pathname: '/voice', params: { visitId: paramStr(visitId) } });
}

export function isWeb() {
  return Platform.OS === 'web';
}
