# Phase E 卡点表（实机走通记录）

> 运行 `docs/demo/preflight-checklist.md` §6 时，遇到任何阻塞项都登记在这里。  
> "阻塞" = 不修就不能在 5 分钟内走完主路径或录屏。

## 记录格式

| 日期 | 操作人 | 卡点 | 重现步骤 | 修复 PR/状态 | 是否阻塞 |
|------|--------|------|----------|--------------|----------|
| 2026-07-17 | Phase E | 无阻塞 | API unit 50/50 pass；e2e:imv 46/46 pass；demo:env-check pass | — | 无阻塞 |
| 2026-07-17 | Phase E | Expo web 主路径通过（11 场景） | Playwright headless 驱动 RN web + 截图录屏 | 录屏归档至 `agentctms-demo-recording-2min.webm` | 否 |
| 2026-07-18 | Phase E 终检 | 全部验收门槛通过 | `pnpm --filter @clinical/api test` ✓ / `demo:env-check` ✓ / `test:e2e:imv` ✓ | — | 无阻塞 |

## Phase E 终检结论

无 P0/P1 阻塞项。所有验收门槛已通过。

## 修复纪律

- 只修阻塞项；不重构 normalize 核心；
- 任何 fix 必须保证 `pnpm --filter @clinical/api test` 仍 53 全绿 + e2e imv 全绿；
- 修复后在 [preflight §6] 复跑一次并在本表留痕。
