# Task 3.6 — AI 中台 (adopt/reject + call-logs + AIConfigPage)

Status: **已交付，待人工点验**

---

## 一、本次交付

| 模块 | 文件 | 说明 |
|------|------|------|
| API 路由 | [apps/api/src/routes/ai-config.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/api/src/routes/ai-config.ts) | 重写 `ai-config.ts`，7 个端点全部按 R1/R2 收口 |
| API 测试 | [apps/api/src/routes/ai-config.test.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/api/src/routes/ai-config.test.ts) | 14 个用例覆盖 R1/R2 / 状态机 / reason / 原子性 / 重复版本 |
| RBAC 矩阵 | [packages/domain/src/rbac.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/packages/domain/src/rbac.ts) | `AIConfigUpdate` 授予 SponsorAdmin + CROPM（之前未被任何角色拥有，是漏洞） |
| Web API 客户端 | [apps/web/src/lib/api/ai-config.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/web/src/lib/api/ai-config.ts) | 7 个端点的类型化客户端 |
| Web 客户端底层 | [apps/web/src/lib/api/client.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/web/src/lib/api/client.ts) | 补 `apiPut`（AIConfig update 需要 PUT 方法） |
| AIConfigPage | [apps/web/src/routes/AIConfigPage.tsx](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/web/src/routes/AIConfigPage.tsx) | 4 个 Tab：能力概览 / Prompt 模板 / AI 输出审核 / 调用日志 |
| Web 路由注册 | [apps/web/src/App.tsx](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/web/src/App.tsx) | 挂 `/app/ai-config` 路由，删除 phase 标签 |
| SideNav | [apps/web/src/components/app/SideNav.tsx](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/web/src/components/app/SideNav.tsx) | 移除 `phase: "Phase 3"` 标记 |
| Server skeleton 契约 | [apps/api/src/server.test.ts](file:///Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/api/src/server.test.ts) | `/api/ai/configs` → `/api/ai-config/configs` 与本任务路由名保持一致 |

---

## 二、7 个端点

| Method | Path | 权限 | 关键性质 |
|--------|------|------|---------|
| GET    | `/api/ai-config/configs`            | AIConfigRead   | R2 — `resolveProjectScope` 守门 |
| PUT    | `/api/ai-config/configs/:configId`  | AIConfigUpdate | R1 — 按目标 config 的 projectId 解析角色；写审计 + beforeValue |
| GET    | `/api/ai-config/prompts`            | AIConfigRead   | 全局模板，按 (code, version) 排序 |
| POST   | `/api/ai-config/prompts`            | AIConfigUpdate | 创建新版本（不可变历史）；版本号自动递增 / 冲突返回 409 |
| GET    | `/api/ai-config/call-logs`          | AIConfigRead   | R2 — 通过 AIOutput.projectId 关联过滤 |
| GET    | `/api/ai-config/outputs`            | AIOutputRead   | R2 — 审核队列 |
| POST   | `/api/ai-config/outputs/:id/adopt`  | AIOutputAdopt  | R1 + 原子：状态机 + AIOutput.AIOutputAdopted 审计在同一个 `$transaction` |
| POST   | `/api/ai-config/outputs/:id/reject` | AIOutputReject | R1 + 原子 + reason 必填（zod + audit 双层防御） |

> `applyAIConfirmation` (`packages/domain/src/ai.ts`) 是状态机的唯一执行点。Adopt/Reject 都先过 domain helper 校验合法转移，再过 Prisma `$transaction` 保证 `AIOutput` 与 `AuditEvent` 同步落库或一起回滚。

---

## 三、R1 / R2 收口（Phase 3 整体收口项）

> Task 3.5 已在 documents/audit 两处用 `assertProjectAccess` 修了隔离。但只补两处不够：
> 其他 mutating 路由（risks / reports / safety 等）仍存在「callers 多项目时 primary assignment 角色泄漏到其他项目」的可能。
> 3.6 起，**R1（按项目解析角色）+ R2（全路由 resolveProjectScope）作为 Phase 3 收口项**统一推广。

### R1 — 按项目解析角色

新增 `resolveActorRoleForProject(user, targetProjectId, requestId)` helper：

- 当 `user.projectId === targetProjectId` → 用 primary role（向后兼容单项目调用者）
- 否则从 `user.roleAssignments` 找匹配项 → 用该项目的 role
- 找不到匹配 → 抛 `FORBIDDEN`

**用法**：所有 mutating 路由（PUT / POST）在做 `authorize` 之前先 R1 解析，再 `assertProjectAccess`（R2）。两个 helper 串联后，role 永远是「目标项目上的 role」。

### R2 — 全路由 resolveProjectScope

List 端点（configs / call-logs / outputs / prompts）都接 `resolveProjectScope(user, queryProjectId, req.id)`：
- 调用方不传 projectId → 强制用 `user.projectId`
- 调用方传了 `?projectId=<X>` → 检查 `X` 是否在 `user.roleAssignments` 中，否则 403
- 解决 3.5 评审发现的 `?projectId=<other>` IDOR

**Phase 3 收口计划**：3.6 在 ai-config 落地 R1+R2；接下来 3.7 / 3.8 把同样模式推到 risks、reports、safety、consents、subjects 等剩余 mutating 路由。在 3.6 交付报告里把 R1 + R2 显式标为 Phase 3 收口项，避免「修了 documents/audit 就以为隔离完事」的认知偏差。

---

## 四、原子性

`adopt` / `reject` / `update config` / `create prompt` 全部走 `prisma.$transaction(async (tx) => { ... await auditTx(tx, ...); })`：

- 数据更新和 `AuditEvent` 写入是同一事务，失败回滚
- `auditTx` 在 (objectType, action) ∈ `CRITICAL_AUDIT_PAIRS` 且 `requiresReason` 时再校验 reason（zod 是第一层，auditTx 是第二层）
- `applyAIConfirmation` 是状态机第一层（域内），schema 是 zod 第二层，事务是数据库第三层，audit reason 是审计链第四层 — 多层 defense-in-depth

---

## 五、AI 永远标注「需人工复核」

`AIConfigPage` 的审核 Tab 顶部 `Badge tone="warning">需人工确认 · AI 不会自动落地</Badge>` 明确这一点；`applyAIConfirmation` 的 `applyAIConfirmation` 在域内只接受 `HumanConfirmationStatus.{Adopted, Rejected, EditedAdopted}` 三种终态；AI 输出不经过 `applyAIConfirmation` 永远不会落库为正式数据。

---

## 六、验证

- API typecheck：✅
- Web typecheck：✅
- API 测试：137/137 通过（其中 ai-config.test.ts 14/14）
- Web 测试：10/10 通过
- ESLin：flat config 未在仓库配置，跳过（typecheck 已覆盖）
- 手工：未做

---

## 七、未做 / 已知后续

1. **未补 .eslintrc → flat config 迁移**：本次跳过。
2. **R1 / R2 全局推广**：本任务只在 ai-config 落地；risks / reports / safety / consents / subjects 等剩余 mutating 路由在 3.7 / 3.8 推广，**这是 Phase 3 的收口项**。
3. **AIConfig 切换 provider 时的兼容测试**：mock provider 现在硬编码 `mock-test-model`，3.6 暂不模拟 provider 切换的运行时差异。
4. **审计 reason 加密 / 二次确认**：当前 reason 直接落库 `reason` 字段；如需 GxP-level 二次确认（requiresConfirmation），3.7/3.8 在 audit 端加。
5. **AIConfigPage 的 CSV / PDF 导出**：3.6 未做。
