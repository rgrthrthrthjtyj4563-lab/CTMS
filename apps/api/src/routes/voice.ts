import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../lib/auth.js';
import { transcribeAudioFile, TranscribeError } from '../lib/transcribe.js';
import { logAudit } from '../lib/audit.js';

export async function voiceRoutes(app: FastifyInstance) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  app.post('/transcribe', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: '未上传录音文件' } });
    }

    await mkdir(uploadDir, { recursive: true });
    const ext = path.extname(data.filename) || '.m4a';
    const storedName = `voice-${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    try {
      await pipeline(data.file, createWriteStream(filePath));
      const { transcript, source } = await transcribeAudioFile(filePath, data.mimetype);

      await logAudit({
        type: 'VOICE_TRANSCRIBED',
        userId: user.id,
        entityType: 'VoiceInput',
        entityId: storedName,
        payload: { source, length: transcript.length },
      });

      return {
        transcript,
        source,
        sensitiveHints: transcript.match(/\d{2,}号受试者|受试者\d+/g) ?? [],
      };
    } catch (err) {
      const code = err instanceof TranscribeError ? err.code : 'ASR_FAILED';
      const message = err instanceof Error ? err.message : '语音转写失败';
      return reply.status(code === 'ASR_UNAVAILABLE' ? 503 : 422).send({
        error: { code, message },
      });
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  });
}