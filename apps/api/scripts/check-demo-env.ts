/**
 * check-demo-env — 演示前置环境检查（只读，不改 .env）
 *
 * 用法（推荐）：
 *   pnpm --filter @clinical/api demo:env-check
 *   pnpm demo:env-check
 *   pnpm --filter @clinical/api exec tsx scripts/check-demo-env.ts [path/to/.env]
 *
 * 退出码：0 = DEMO 可演示；1 = 未配置 / 路径错 / 值非法
 *
 * 查找 .env 顺序：
 *   1) CLI 参数
 *   2) cwd/.env（在 apps/api 下执行时）
 *   3) cwd/apps/api/.env（在 monorepo 根执行时）
 *   4) 相对本脚本的 ../.env（apps/api/.env）
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

function resolveEnvPath(): string {
  if (process.argv[2]) {
    return path.resolve(process.cwd(), process.argv[2]);
  }
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.join(apiRoot, '.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Prefer api package .env in error message
  return path.join(apiRoot, '.env');
}

function fail(reason: string, envPath: string): never {
  console.error(`✗ demo env check failed: ${reason}`);
  console.error(`  checked: ${envPath}`);
  console.error(`  fix: 在 apps/api/.env 中写入 DEMO_MODE=1 后重跑 pnpm demo:env-check`);
  process.exit(1);
}

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }
  return parsed;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function isTruthyDemo(value: string | undefined): boolean {
  if (value == null) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

const envPath = resolveEnvPath();

if (!existsSync(envPath)) {
  fail(`.env 文件不存在`, envPath);
}

let content: string;
try {
  content = readFileSync(envPath, 'utf8');
} catch (e) {
  fail(`读取失败：${e instanceof Error ? e.message : String(e)}`, envPath);
}

const parsed = parseEnvFile(content);

// File takes precedence; process.env can satisfy if file missing key (demo shell export).
const fileMode = parsed.DEMO_MODE;
const fileProfile = parsed.DEMO_PROFILE;
const envMode = process.env.DEMO_MODE;
const envProfile = process.env.DEMO_PROFILE;

const demoOn =
  isTruthyDemo(fileMode) ||
  (fileProfile || '').trim().toLowerCase() === 'demo' ||
  isTruthyDemo(envMode) ||
  (envProfile || '').trim().toLowerCase() === 'demo';

if (!demoOn) {
  if (fileMode != null && !isTruthyDemo(fileMode)) {
    fail(`DEMO_MODE=${fileMode} 不是真值（期望 1 / true / yes / on）`, envPath);
  }
  if (!('DEMO_MODE' in parsed) && !envMode && !envProfile && fileProfile == null) {
    fail('缺少 DEMO_MODE=1（文件与 process.env 均未开启演示模式）', envPath);
  }
  fail('演示模式未开启（DEMO_MODE / DEMO_PROFILE）', envPath);
}

const effective =
  isTruthyDemo(fileMode) || (fileProfile || '').trim().toLowerCase() === 'demo'
    ? `file DEMO_MODE=${fileMode ?? ''} DEMO_PROFILE=${fileProfile ?? ''}`
    : `process.env DEMO_MODE=${envMode ?? ''} DEMO_PROFILE=${envProfile ?? ''}`;

console.log(`✓ demo env ok（${envPath}）`);
console.log(`  ${effective.trim()}`);
process.exit(0);
