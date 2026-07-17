/**
 * Root shim: prefer `pnpm demo:env-check`.
 * Delegates to apps/api so tsx resolves from the api package.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['--filter', '@clinical/api', 'demo:env-check', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status === null ? 1 : result.status);
