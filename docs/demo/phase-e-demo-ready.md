# Phase E：Demo Ready（演示可放映）

> 基线：`v0.1-agentctms-demo-freeze` (1ba15fa)  
> 分支：`demo/app-mvp`（从此 tag 拉出）  
> 上游冻结：`wip/app-v1-rebaseline`  
> 一句话：把「文档与 seed 已齐」补成「真机能演、能录」。

## 1. 本期定位

- 产品目标：投资人可看、可讲、可录的 AgentCTMS MVP
- 技术目标：演示环境可重复；主路径无死链；生成结果类型可控
- 非目标：完整 Web CTMS、ePRO、SubjectVisit、伦理/药械、正式 CAPA、时间压迫计时
- 范围纪律：禁止 Web 全后台、受试者相关新功能；禁止改 `packages/domain`/`apps/api/src/lib/normalize*` 核心

## 2. 任务清单与产出

| ID | 任务 | 产出 | 优先级 |
|----|------|------|--------|
| E0 | 演示前检查清单 | `docs/demo/preflight-checklist.md` | P0 |
| E1 | 强制可控生成（`DEMO_MODE=1` 或演示 profile） | API 改动 + 文档 | P0 |
| E2 | 主路径实机走通 + 卡点清单 | `docs/demo/e2e-blockers.md` + 必要小修 | P0 |
| E3 | 行动包「可讲」最小 UI | mobile 有限 diff | P0 |
| E4 | 退回闭环演示（30s 分镜） | 脚本补段 + 已有 API | P0 |
| E5 | 回归护栏 | test 47+ 绿；`test:e2e:imv` 绿 | P0（贯穿） |
| E6 | 2 分钟录屏 + 归档 | 视频路径 + `demo-recording-2min.md` 勾选 | P0 |
| E7 | 把 `agentctms-mvp-development-plan.md` 纳入 git | commit | P1 |
| E8 | 修正 demo-script 文末 checklist 勾选 | `agentctms-mvp-demo-script.md` | P1 |
| E9 | seed-demo 去掉无效 void bcrypt | `apps/api/prisma/seed-demo.ts` | P1 |
| E10 | e2e/脚本与「期望类型清单」对齐说明 | `docs/demo/expected-types.md` | P1 |

P2（明确不做）：Web L1 轻审核、AI 原始脏输出 raw 存档、底部 review Tab、完整报告模板、附件 OCR 生产级、CTMS 后台菜单扩展。

## 3. 推荐顺序（4–6 工作日）

- Day 1     E0 + E1（DEMO_MODE 开关 + 检查清单）
- Day 1–2   E2（按脚本实机走通，只修阻塞卡点）
- Day 2–3   E3（行动包/确认/提交/审核可讲小打磨）
- Day 3     E4 + E5（退回分镜 + 全绿）
- Day 4     E6（录屏 + 材料勾选）
- 并行      E7–E10（文档与卫生）

## 4. 完成定义（Done）

全部勾选才算 Phase E 完成：

1. `db:reset → db:seed → db:seed:demo → API start → APP 登录`，不看代码能进今日 IMV（ZZ-101）
2. 固定口播输入后，行动包稳定出现约定类型（访视记录、工时、≥1 Issue、任务、报告草稿）
3. CRA 确认 → 提交 → PM 通过/退回均可演示；退回时 CRA 工作台见原因
4. 任意 1 条候选能指出来源/状态（口播 + 屏幕一致）
5. `pnpm --filter @clinical/api test` 全绿；`test:e2e:imv` 全绿
6. 存在 2 分钟录屏文件 + 5 分钟脚本可照读
7. 范围未膨胀（无 Web 全后台、无受试者等）

## 5. 与下一期的衔接

- Phase F：Web L1（登录+待审+通过/退回）—— 投资人明确要电脑投屏且 APP 已稳定录屏
- Phase G：多访视类型 / PM-QA 加深 —— 融资故事要扩 scope
- 治本 AI 质量 —— MODEL 路径要上生产

## 6. 给执行 AI 的指令（可整段贴）

```
基于 tag v0.1-agentctms-demo-freeze，在分支 demo/app-mvp 上执行 Phase E（Demo Ready）：
- E1 强制演示可控生成（DEMO_MODE=1 或 DEMO_PROFILE=demo 强制走 rules，即使有 LLM key）
- E0/E7/E8/E10 文档
- E2 按 docs/demo/agentctms-mvp-demo-script.md 实机打通 5 分钟路径，只修阻塞
- E3 mobile 行动包候选/来源/状态最小可讲
- E4 补 30s 退回分镜脚本
- E5 保持 pnpm test + test:e2e:imv 全绿
- E6 产出 2 分钟录屏并归档
禁止：Web 全后台、受试者相关、改 packages/domain 核心 normalize、改 seed 结构。
```