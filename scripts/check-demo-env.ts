#!/usr/bin/env node
/**
 * check-demo-env — 演示前置环境检查（手动调用，不挂 prebuild）
 *
 * 用法：
 *   node scripts/check-demo-env.ts                # 默认检查 apps/api/.env
 *   node scripts/check-demo-env.ts path/to/.env   # 自定义 .env 路径
 *
 * 退出码：
 *   0 = DEMO_MODE=1 已配置（可演示）
 *   1 = 缺失 .env / 缺 DEMO_MODE / 值不是 1 / 关键变量缺失
 *
 * 范围：本脚本只做"读 + 检查"，不修改任何 .env。
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// 说明：脚本运行时会触发 Node 的 MODULE_TYPELESS_PACKAGE_JSON 性能警告
// （因根 package.json 未声明 type）。本脚本不修该警告，避免改动 root pkg；
// 用 NODE_NO_WARNINGS=1 或 tsx 均可抑制。

const DEFAULT_ENV_PATH = resolve(process.cwd(), 'apps/api/.env');
const envPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : DEFAULT_ENV_PATH;

function fail(reason: string): never {
  console.error(`✗ demo env check failed: ${reason}`);
  console.error(`  checked: ${envPath}`);
  console.error(`  fix: 在 .env 中加入 DEMO_MODE=1（或运行前 export DEMO_MODE=1）`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  fail(`.env 文件不存在（${envPath}）`);
}

let content: string;
try {
  content = readFileSync(envPath, 'utf8');
} catch (e) {
  fail(`读取失败：${e instanceof Error ? e.message : String(e)}`);
}

// 解析 KEY=VALUE，忽略注释行与空行
const parsed: Record<string, string> = {};
for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  // 去引号
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  parsed[key] = val;
}

if (!('DEMO_MODE' in parsed)) {
  fail('缺少 DEMO_MODE 键');
}

const demoMode = parsed.DEMO_MODE;
const truthy = new Set(['1', 'true', 'TRUE', 'yes', 'YES', 'on', 'ON']);
if (!truthy.has(demoMode)) {
  fail(`DEMO_MODE=${demoMode} 不是真值（期望 1 / true / yes / on）`);
}

console.log(`✓ demo env ok: DEMO_MODE=${demoMode}（${envPath}）`);

// 可选附加提示：展示其它 demo 相关开关（如有）
const demoKeys = Object.keys(parsed)
  .filter((k) => k === 'DEMO_MODE' || k.startsWith('DEMO_'))
  .sort();
if (demoKeys.length > 0) {
  console.log('  demo 开关：');
  for (const k of demoKeys) {
    console.log(`    ${k}=${parsed[k]}`);
  }
}