import { Platform } from 'react-native';

export type LocalFile = {
  uri: string;
  name: string;
  mimeType?: string;
  /** Web: real Blob/File for FormData */
  blob?: Blob;
};

/**
 * Build a FormData-compatible file part.
 * - Web: must be Blob/File (RN {uri} shape is ignored by browsers)
 * - Native: { uri, name, type } for React Native fetch
 */
export async function toFormDataFile(
  file: LocalFile,
): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS === 'web') {
    if (file.blob) {
      return file.blob instanceof File
        ? file.blob
        : new File([file.blob], file.name, {
            type: file.mimeType || file.blob.type || 'application/octet-stream',
          });
    }
    const res = await fetch(file.uri);
    if (!res.ok) {
      throw new Error('无法读取本地文件，请重新选择或录音');
    }
    const blob = await res.blob();
    return new File([blob], file.name, {
      type: file.mimeType || blob.type || 'application/octet-stream',
    });
  }

  return {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  };
}
