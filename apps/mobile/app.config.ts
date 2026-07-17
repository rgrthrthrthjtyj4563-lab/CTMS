import type { ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

const config: ExpoConfig = {
  name: 'AI临床运营',
  slug: 'ai-clinical-operations',
  version: '2.6.1',
  orientation: 'portrait',
  scheme: 'clinicalops',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#0B7070',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.clinical.ops',
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0B7070',
    },
    package: 'com.clinical.ops',
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        cameraPermission: '允许拍照以采集现场证据',
        photosPermission: '允许访问相册以选择证据文件',
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: '允许录音以录入现场工作事实',
      },
    ],
  ],
  extra: {
    apiUrl,
    router: {},
  },
};

// Cleartext HTTP for local API during development (not in ExpoConfig types)
(config.android as Record<string, unknown>).usesCleartextTraffic = true;

export default config;