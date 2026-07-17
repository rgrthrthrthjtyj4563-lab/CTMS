import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = path.join(apiRoot, 'test-uploads');
process.env.NODE_ENV = 'test';
// Keep tests offline — never call external LLM/ASR/Vision APIs
process.env.TEXT_LLM_API_KEY = '';
process.env.XAI_API_KEY = '';
process.env.MULTIMODAL_API_KEY = '';
process.env.ASR_API_KEY = '';

beforeAll(() => {
  const testDb = path.join(apiRoot, 'test.db');
  try {
    unlinkSync(testDb);
  } catch {
    // fresh db
  }
  try {
    execSync('npx prisma migrate deploy', {
      cwd: apiRoot,
      env: process.env,
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`prisma migrate deploy failed for test.db — tests must not skip.\n${msg}`, { cause: err });
  }
  try {
    execSync('npx tsx prisma/seed.ts', {
      cwd: apiRoot,
      env: process.env,
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`prisma seed failed for test.db.\n${msg}`, { cause: err });
  }
});

afterAll(() => {
  try {
    execSync('npx prisma db push --force-reset', {
      cwd: apiRoot,
      env: process.env,
      stdio: 'pipe',
    });
  } catch {
    // ignore cleanup errors
  }
});
