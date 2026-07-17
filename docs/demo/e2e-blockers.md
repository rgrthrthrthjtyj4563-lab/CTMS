# Phase E 卡点表（实机走通记录）

> 运行 `docs/demo/preflight-checklist.md` §6 时，遇到任何阻塞项都登记在这里。  
> "阻塞" = 不修就不能在 5 分钟内走完主路径或录屏。

## 记录格式

| 日期 | 操作人 | 卡点 | 重现步骤 | 修复 PR/状态 | 是否阻塞 |
|------|--------|------|----------|--------------|----------|
|      |        |      |          |              |          |

（实机走通时直接续表）

## 当前已知事项（非阻塞，已纳入 preflight）

- `test:e2e:imv` 需要 API 服务已启动 + `db:seed`：脚本在 API 不可用时 exit 2。  
  → 这是预期；启动顺序在 preflight §3/§5 已说明。
- `apps/mobile` 启动需 Expo Go 或模拟器；演示日建议提前 10 分钟热起。
- `prisma/dev.db` 在 reset 后必重新生成；演示日不要跨日使用旧库。

## 修复纪律

- 只修阻塞项；不重构 normalize 核心；
- 任何 fix 必须保证 `pnpm --filter @clinical/api test` 仍 47 全绿 + e2e imv 全绿；
- 修复后在 [preflight §6] 复跑一次并在本表留痕。