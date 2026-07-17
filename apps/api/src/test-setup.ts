import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const testDb = path.join(apiRoot, 'test.db');

// Absolute file URL so Prisma never accidentally targets prisma/dev.db via relative path
process.env.DATABASE_URL = `file:${testDb}`;
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = path.join(apiRoot, 'test-uploads');
process.env.NODE_ENV = 'test';
// Keep tests offline — never call external LLM/ASR/Vision APIs
process.env.TEXT_LLM_API_KEY = '';
process.env.XAI_API_KEY = '';
process.env.MULTIMODAL_API_KEY = '';
process.env.ASR_API_KEY = '';

function removeTestDbFiles() {
  for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      // ignore locked/missing
    }
  }
}

beforeAll(() => {
  removeTestDbFiles();
  // db push is more reliable than migrate deploy for ephemeral test.db
  // (avoids P3005 when a leftover non-empty file has no migration history).
  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`prisma db push failed for test.db — tests must not skip.\n${msg}`, {
      cause: err,
    });
  }
  try {
    execSync('npx tsx prisma/seed.ts', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: `file:${testDb}` },
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`prisma seed failed for test.db.\n${msg}`, { cause: err });
  }
});

afterAll(() => {
  removeTestDbFiles();
});
