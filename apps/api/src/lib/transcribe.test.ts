import { describe, it, expect } from 'vitest';
import { transcribeAudioFile, TranscribeError } from './transcribe.js';

describe('transcribeAudioFile', () => {
  it('throws ASR_UNAVAILABLE when API key is missing', async () => {
    const prev = process.env.ASR_API_KEY;
    process.env.ASR_API_KEY = '';
    await expect(transcribeAudioFile('/nonexistent.m4a')).rejects.toMatchObject({
      code: 'ASR_UNAVAILABLE',
    });
    process.env.ASR_API_KEY = prev;
  });

  it('never returns hardcoded fallback text', async () => {
    process.env.ASR_API_KEY = '';
    try {
      await transcribeAudioFile('/nonexistent.m4a');
    } catch (e) {
      expect(e).toBeInstanceOf(TranscribeError);
      expect((e as Error).message).not.toContain('华山医院做了IMV');
    }
  });
});