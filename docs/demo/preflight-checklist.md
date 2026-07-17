# Demo 前检查清单（Pre-flight Checklist）

> 在按 `docs/demo/agentctms-mvp-demo-script.md` 走 5 分钟主路径前，依次过一遍。  
> 全绿 = 可录屏、可讲、可投放。

## 1. 仓库与基线

- [ ] 在分支 `demo/app-mvp`（自 `v0.1-agentctms-demo-freeze` 切出）
- [ ] `git status` 干净或仅有本次 Phase E 改动
- [ ] `node -v` ≥ 18；`pnpm -v` ≥ 8

## 2. 依赖与数据库

- [ ] `pnpm install` 已执行
- [ ] `pnpm --filter @clinical/api db:reset` 成功（删库重建）
- [ ] `pnpm --filter @clinical/api db:seed` 成功（基础账号/项目/中心）
- [ ] `pnpm --filter @clinical/api db:seed:demo` 成功（演示 IMV：ZZ-101）
- [ ] `apps/api/prisma/dev.db` 已生成

## 3. 环境变量（`apps/api/.env`）

> 演示日 `TEXT_LLM_API_KEY` 是否配置都可；**录屏/投资人演示必须开 DEMO_MODE**。

- [ ] **`DEMO_MODE=1`**（**有 key 也强制 rules**，输出确定）
  - 或 `DEMO_PROFILE=demo`
  - 都不设 = 有 key 时走 MODEL（输出可能漂，**禁止录屏**）
- [ ] 运行检查（必须 exit 0）：
  ```bash
  pnpm demo:env-check
  # 或：pnpm --filter @clinical/api demo:env-check
  ```
- [ ] `JWT_SECRET` 与 `apps/api/.env.example` 中保持一致，或新值但重启 API
- [ ] `DATABASE_URL="file:./dev.db"`
- [ ] `UPLOAD_DIR=./uploads`（演示附件会落到此目录）

> 验证：`pnpm demo:env-check` 通过后启动 API，日志应出现  
> `[DEMO_MODE] forcing rule-based action pack generation`。

## 4. 账号速查（来自 seed / seed:demo）

| 角色 | 登录账号 | 密码 | 可见范围 |
|------|----------|------|----------|
| CRA  | `13800138001` | `password` | 今日 IMV 行动包/确认/提交 |
| PM   | `13800138002` | `password` | 工作台审核/通过/退回 |

> 演示上下文：先 `db:seed` 再 `db:seed:demo`（切到 ZZ-101 / 上海六院）。

## 5. API & Mobile 启动

- [ ] `pnpm --filter @clinical/api dev`（端口 3001）—— 看到 `API server running at http://0.0.0.0:3001`
- [ ] `pnpm --filter @clinical/mobile start`（Expo，按提示 i/Android/web 任选）
- [ ] `curl -s http://localhost:3001/api/health` 返回 `{ ok: true }`

## 6. 主路径 5 分钟冒烟（手测一次，确认无阻塞）

> 完整脚本：`docs/demo/agentctms-mvp-demo-script.md`

- [ ] CRA 登录 → 项目选择 → 进入今日 IMV（ZZ-101）
- [ ] 口播（或粘贴）固定文本 → 生成行动包 → 候选稳定出现  
       （监查访视记录 / 工时 / Issue / 任务 / 报告草稿 至少 5 类）
- [ ] 任选 1 条候选 → "来源/状态" 在 UI 上能看到
- [ ] CRA 确认 → 提交 → PM 端可见 → PM 通过/退回（任选其一）
- [ ] 退回场景：CRA 工作台出现 `rejectionReason` 且能定位到那条候选

> 任何一项卡住，先记入 `docs/demo/e2e-blockers.md`，**只修阻塞项**，不动 normalize 核心。

## 7. 录屏准备（E6）

- [ ] 屏幕录制工具就位（macOS QuickTime / OBS 任选），目标 ≤ 2 分钟
- [ ] 麦克风可用（讲稿在 `agentctms-mvp-demo-script.md`）
- [ ] 录屏前关闭无关通知（勿弹出 IDE 错误）

## 8. 全绿护栏（E5）

- [ ] `pnpm --filter @clinical/api test` 全绿
- [ ] `pnpm --filter @clinical/api test:e2e:imv` 全绿  
       （脚本：`apps/api/scripts/e2e-imv-mainflow.ts`）

## 9. 范围纪律

- [ ] 本期未引入 Web 全后台、受试者相关、伦理/药械、ePRO、SubjectVisit
- [ ] 未改 `packages/domain` 与 `apps/api/src/lib/normalize*` 核心

---

完成上述全部勾选后，进入 E6 录屏，并在 `docs/demo/agentctms-demo-recording-2min.md` 勾选归档。