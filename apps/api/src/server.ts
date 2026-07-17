import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __envDir = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  loadEnv({ path: path.resolve(__envDir, '..', '.env') });
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { authenticate } from './lib/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { workbenchRoutes } from './routes/workbench.js';
import { monitoringVisitRoutes } from './routes/monitoring-visits.js';
import { actionPackRoutes } from './routes/action-packs.js';
import { todoRoutes } from './routes/todos.js';
import { issueRoutes } from './routes/issues.js';
import { hoursRoutes } from './routes/hours.js';
import { reviewRoutes } from './routes/reviews.js';
import { attachmentRoutes } from './routes/attachments.js';
import { syncRoutes } from './routes/sync.js';
import { auditRoutes } from './routes/audit.js';
import { voiceRoutes } from './routes/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.decorate('authenticate', authenticate);

  await app.register(async (api) => {
    await api.register(healthRoutes);
    await api.register(authRoutes, { prefix: '/auth' });
    await api.register(workbenchRoutes, { prefix: '/workbench' });
    await api.register(monitoringVisitRoutes, { prefix: '/monitoring-visits' });
    await api.register(actionPackRoutes, { prefix: '/action-packs' });
    await api.register(todoRoutes, { prefix: '/todos' });
    await api.register(issueRoutes, { prefix: '/issues' });
    await api.register(hoursRoutes, { prefix: '/hours' });
    await api.register(reviewRoutes, { prefix: '/reviews' });
    await api.register(attachmentRoutes, { prefix: '/attachments' });
    await api.register(syncRoutes, { prefix: '/sync' });
    await api.register(auditRoutes, { prefix: '/audit' });
    await api.register(voiceRoutes, { prefix: '/voice' });
  }, { prefix: '/api' });

  app.setErrorHandler((error: Error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: error.message || '服务器错误' },
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`API server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  start();
}