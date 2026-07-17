import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

interface DoubaoAsrResponse {
  result?: { text?: string };
}

export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly code: 'ASR_UNAVAILABLE' | 'ASR_FAILED' | 'ASR_EMPTY',
  ) {
    super(message);
    this.name = 'TranscribeError';
  }
}

export async function transcribeAudioFile(filePath: string, _mimeType?: string): Promise<{
  transcript: string;
  source: 'bytedance-asr';
}> {
  const apiKey = process.env.ASR_API_KEY;
  if (!apiKey) {
    throw new TranscribeError('语音转写服务未配置，请手动填写转写内容', 'ASR_UNAVAILABLE');
  }

  const buffer = await readFile(filePath);
  const endpoint =
    process.env.ASR_ENDPOINT ||
    'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
  const resourceId = process.env.ASR_RESOURCE_ID || 'volc.bigasr.auc_turbo';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': randomUUID(),
      'X-Api-Sequence': '-1',
    },
    body: JSON.stringify({
      user: { uid: 'clinical-ops-app' },
      audio: { data: buffer.toString('base64') },
      request: { model_name: 'bigmodel' },
    }),
  });

  const apiStatus = res.headers.get('X-Api-Status-Code') ?? '';
  const bodyText = await res.text();
  if (!res.ok || (apiStatus && !apiStatus.startsWith('200'))) {
    throw new TranscribeError(
      `语音转写失败（${res.status || apiStatus}），请重试或手动填写`,
      'ASR_FAILED',
    );
  }

  const payload = JSON.parse(bodyText) as DoubaoAsrResponse;
  const text = payload.result?.text?.trim();
  if (!text) {
    throw new TranscribeError('未识别到语音内容，请重试或手动填写', 'ASR_EMPTY');
  }

  return { transcript: text, source: 'bytedance-asr' };
}