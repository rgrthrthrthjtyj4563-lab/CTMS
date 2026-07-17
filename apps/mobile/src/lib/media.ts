import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import type { LocalFile } from './upload';

export type PickedFile = LocalFile;

function pickViaHtmlInput(options: {
  accept: string;
  capture?: boolean;
}): Promise<PickedFile | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    if (options.capture) {
      input.setAttribute('capture', 'environment');
    }
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({
        uri,
        name: file.name || `file-${Date.now()}`,
        mimeType: file.type || undefined,
        blob: file,
      });
    };

    // User cancelled: no reliable event on all browsers; resolve null after focus returns empty
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) {
          cleanup();
          resolve(null);
        }
      }, 400);
    };
    window.addEventListener('focus', onFocus);

    input.click();
  });
}

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function pickPhotoFromCamera(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') {
    // Prefer capture when supported; falls back to file picker
    return pickViaHtmlInput({ accept: 'image/*', capture: true });
  }
  const ok = await requestCameraPermission();
  if (!ok) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

export async function pickImageFromLibrary(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') {
    return pickViaHtmlInput({ accept: 'image/*' });
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

export async function pickDocument(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') {
    return pickViaHtmlInput({ accept: '*/*' });
  }
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const d = result.assets[0];
  return {
    uri: d.uri,
    name: d.name,
    mimeType: d.mimeType ?? 'application/octet-stream',
  };
}

export type VoiceRecorder = {
  stop: () => Promise<{ uri: string; durationMs: number; blob?: Blob }>;
};

export async function startVoiceRecording(): Promise<VoiceRecorder | null> {
  if (Platform.OS === 'web') {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(200);
      const startedAt = Date.now();
      return {
        stop: () =>
          new Promise((resolve, reject) => {
            recorder.onerror = () => {
              stream.getTracks().forEach((t) => t.stop());
              reject(new Error('录音失败'));
            };
            recorder.onstop = () => {
              stream.getTracks().forEach((t) => t.stop());
              const type = recorder.mimeType || mimeType || 'audio/webm';
              const blob = new Blob(chunks, { type });
              const uri = URL.createObjectURL(blob);
              resolve({ uri, durationMs: Date.now() - startedAt, blob });
            };
            if (recorder.state !== 'inactive') {
              recorder.stop();
            } else {
              reject(new Error('录音未开始'));
            }
          }),
      };
    } catch {
      return null;
    }
  }

  const ok = await requestMicPermission();
  if (!ok) return null;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  const startedAt = Date.now();
  return {
    stop: async () => {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('录音保存失败');
      return { uri, durationMs: Date.now() - startedAt };
    },
  };
}

export function detectSensitiveHints(fileName: string): string[] {
  const hints: string[] = [];
  if (/身份证|id\s*card/i.test(fileName)) hints.push('可能包含身份证号');
  if (/手机|电话|contact/i.test(fileName)) hints.push('可能包含联系方式');
  if (/姓名|name/i.test(fileName)) hints.push('可能包含姓名');
  return hints;
}
