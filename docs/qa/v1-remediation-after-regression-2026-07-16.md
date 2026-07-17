# V1 回归后整改方案与复盘

> 对照测试报告：`V1 Web 回归测试报告 — 部分执行总结`（2026-07-16）  
> 仓库：`/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验`  
> 状态：P0-5 / 作废展示 **代码已按本方案落地**，需 Web 硬刷新复测

---

## 1. 对照测试结论（事实对齐）

### 1.1 已通过（保持）

| 区域 | 结论 |
|---|---|
| 自动化 | API 27/27、typecheck、smoke 均真实通过 |
| 登录 / 导航 Tab | 可用 |
| P0-1 输入框单层边框 | 通过 |
| P0-2 编辑 | 弹窗、原因校验、保存可用 |
| P0-3 选图入口 | 弹出「添加照片」 |
| 现场页活动清单 / 分钟时长 / 无实时转写 | 通过 |
| 总结页内容、行动包 origin/来源、逐项确认 | 通过（在 API 辅助进总结后） |
| CRA 无 PM 审核按钮 | 通过 |

### 1.2 失败 / 风险

| ID | 报告结论 | 代码根因（对照后） | 严重度 |
|---|---|---|---|
| **P0-5** | 点结束卡「处理中…」不跳转；API complete 已成功 | ① 结束流调用 **`completeVisit` 含 AI 生成**，有 LLM key 时极慢，UI 长时间 busy；② **`router.replace` 在 Expo Web 常静默失败且不 throw**，try/catch 无效；③ 成功后无手动兜底入口 | **P0 阻塞** |
| **作废待复查** | API 显示 voided=False | 工作台 timeline 查询 **未过滤 `isVoided: false`**，作废后仍可能被看到；字段名是 **`isVoided`** 不是 `voided` | P1 |
| **P0-4 语音** | 未测 | 仍需 Web 实机复测 FormData/Blob | 未关闭 |
| **P0-6 PM 审核** | 未测 | 代码有 `mode=review`，缺实测 | 未关闭 |
| 工具上限 | 剧本 B/C 未跑完 | 流程问题，非产品功能 | 测试覆盖缺口 |

### 1.3 总判定（与报告一致）

**未达 V1 验收** —— 主链被 **P0-5 前端结束跳转** 阻塞；后端闭环基本可用。

---

## 2. 根因分析（P0-5 详细）

### 2.1 原实现路径

```
用户点「结束访视」
  → setBusy(true)  // 按钮变「处理中…」
  → await api.completeVisit(visitId)
       → POST /complete
       → 状态改为 PENDING_WRAP_UP
       → createActionPackFromAi()  // 可能调用外部 LLM，数秒～超时
  → goVisitSummary(visitId, packId)
       → router.replace({ pathname, params })  // Web 可能无跳转且不抛错
  → finally setBusy(false)
```

### 2.2 为何表现为「卡处理中」

1. **长时间 await**：`complete` = 结束 + 生成行动包。若环境配置了 `TEXT_LLM_API_KEY` / `XAI_API_KEY`，生成阶段会卡住按钮。  
2. **跳转不可靠**：Expo Router Web 对 object 形式 `replace` 常见「调用成功、页面不变」。旧代码用 try/catch 无法捕获。  
3. **测试视角分裂**：curl/API 辅助看到 complete 成功；UI 仍停在 imv-active —— 报告描述与代码完全吻合。

### 2.3 设计错误（更底层）

把 **「结束访视」（用户瞬时动作）** 和 **「生成行动包」（重计算）** 绑在同一 UI 等待上，违反：

- 用户操作应 **200ms～2s 内有页面反馈**  
- 重任务应在 **下一页 loading** 展示  

---

## 3. 整改方案（已实施 + 待复测）

### 3.1 P0-5 结束访视（已改代码）

| 改动 | 文件 | 做法 |
|---|---|---|
| 快结束 | `imv-active.tsx` / `workbench.tsx` | 先 `endVisit`（仅改状态），**立刻** `goVisitSummary` |
| 慢生成下沉 | `visit-summary.tsx` | 进入后 `completeVisit` 幂等生成包，loading 文案提示「首次可能需数秒」 |
| 导航加固 | `navigation.ts` | replace 对象 → replace 字符串 href → push → 延迟重试 → Alert 手动进入 |
| 参数规范化 | `params.ts` | Web 上 `visitId` 可能是 `string[]`，统一 `paramStr` |

**验收：**

1. 硬刷新 Web。  
2. CRA 现场页点「结束访视」→ **2 秒内**离开现场页进入总结（可先看到「正在生成行动包」）。  
3. 不依赖 curl 辅助导航。  
4. 连点结束：幂等、不崩。  

### 3.2 作废待复查（已改）

| 改动 | 文件 |
|---|---|
| timeline 过滤 `isVoided: false` | `apps/api/src/routes/workbench.ts` |

**验收：** 作废后工作台今日记录消失；DB/API 字段为 **`isVoided: true`**（勿查 `voided`）。

### 3.3 仍须补测（未因本报告自动关闭）

| 项 | 动作 |
|---|---|
| P0-4 语音 | Web 录 3s → 停止 → 无「未上传录音文件」→ 可发送 |
| P0-3 完整上传 | 选用途后上传成功，记录出现用途文案 |
| P0-6 PM | 提交后 PM 待办 → 审核模式三按钮 → 通过/退回 |
| 剧本 C | 幂等、工时切月、无访视按钮 |

### 3.4 建议补充的防护（下一迭代）

| 项 | 说明 |
|---|---|
| complete 服务端超时 / 生成中状态 | `ActionPack.status=GENERATING`，二次请求返回进行中 |
| E2E 导航用例 | Playwright：点结束 → URL 含 visit-summary |
| 结束按钮 | 成功后立即 `setBusy(false)` 并禁用，防双点 |

---

## 4. 为什么会出现「整改后仍遗留」——复盘

### 4.1 测试环境与开发验证环境不一致

| 维度 | 开发/smoke 时 | 回归 Web 时 |
|---|---|---|
| 行动包生成 | 常无 LLM key → 规则瞬间返回 | 可能有 LLM → 卡住 |
| 导航验证 | smoke 只测 API，**不测 Expo Web 路由** | 真 Web `router.replace` 行为不同 |
| 验收标准 | 「API complete 200」 | 「用户看见总结页」 |

**教训：** 主路径验收必须以 **用户可见页面变化** 为准，API 200 只是必要非充分。

### 4.2 修复层叠在错误抽象上

第一轮把「结束 + 生成」做成一个按钮等待，第二轮只改了 `goVisitSummary` 的 pathname 形式，**没有拆开快慢路径**，所以 P0-5 以另一种形态复现（从「完全不跳」变成「卡处理中」或静默不跳）。

**教训：** 修导航 bug 时要同时检查 **await 链是否过长**。

### 4.3 自动化假安全感

smoke 覆盖 complete 幂等，**零覆盖** `router` / 页面栈。typecheck 全绿不表示 Web 可点。

**教训：** 每个曾失败的 P0 必须有一条 **浏览器级** 复现用例（人工清单或 Playwright），不能只靠 API。

### 4.4 try/catch 误用

对「不抛错的失败」（Expo Router no-op）写 try/catch 等于没写。

**教训：** 导航后应 **断言路由结果** 或提供 **始终可见的手动入口**。

### 4.5 作废「假失败」

UI 调了 void API，列表仍显示，是因为 **读路径未过滤作废**，被误判为作废无效。

**教训：** 写路径与读路径要成对改；验收字段名与 schema 对齐（`isVoided`）。

### 4.6 测试执行被工具上限截断

PM/语音未测却进入总判定，合理；但报告应标明 **「未测 ≠ 通过」**。本方案未关闭项保持 ⚠️。

### 4.7 交付节奏

「先止血再闭环」压力下，**跳转成功**被 API 成功代替；缺 **DoD 清单勾选**：结束访视 = 必须看到 visit-summary。

---

## 5. 工程原则（写进团队约定）

1. **用户手势 ≤ 2s 内换页或明确进度**；重计算放下一屏。  
2. **每个 P0 回归 = API 断言 + Web 可见断言**。  
3. **导航失败要有手动出口**，禁止只依赖一次 `replace`。  
4. **参数一律 `paramStr`**，防 Web `string[]`。  
5. **列表读模型默认排除作废/软删**。  
6. **有 LLM 的路径必须可降级、可超时提示**。  

---

## 6. 复测清单（请测试 AI / 人工按此执行）

```text
1. 重启或硬刷新 Expo Web（避免旧 bundle）
2. pnpm db:seed（如无可用访视）
3. CRA 登录 → 开始 IMV → 录一条文字
4. 点「结束访视」
   期望：离开现场页，进入总结（可短暂「生成行动包」）
5. 总结 → 行动包 → 逐项确认 → 提交
6. 作废一条记录 → 工作台列表消失；API isVoided=true
7. （补）语音、PM 审核
```

---

## 7. 代码变更索引（本轮）

| 文件 | 变更 |
|---|---|
| `apps/mobile/src/lib/navigation.ts` | 多策略跳转 + 延迟重试 + 手动入口 |
| `apps/mobile/src/lib/params.ts` | 新增 param 规范化 |
| `apps/mobile/app/imv-active.tsx` | 快结束 + 立即跳转 |
| `apps/mobile/app/(tabs)/workbench.tsx` | 同上 |
| `apps/mobile/app/visit-summary.tsx` | 生成包 loading 提示 + paramStr |
| `apps/api/src/routes/workbench.ts` | timeline 过滤 isVoided |

---

## 8. 一句话总结

**遗留不是「没写 complete」，而是「把慢 AI 绑在结束按钮上 + Web 导航静默失败 + 自动化不看页面」。**  
本轮拆开快结束与慢生成，并加固导航与作废列表过滤；**请硬刷新后只验 P0-5 与作废**，再补 PM/语音关闭 V1。
