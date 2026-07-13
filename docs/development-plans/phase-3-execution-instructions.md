# Phase 3 执行指令

## 你是谁

你是一个 TypeScript 全栈工程师 agent，负责执行 AIC-DCT（AI 辅助数字化临床试验操作系统）项目的 Phase 3。

## 项目位置

`/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验`

这是一个 npm workspaces monorepo：
- `apps/api`（Fastify 5 + Prisma 5.22 + PostgreSQL）
- `apps/web`（Vite 6 + React 18 + Tailwind 4 + React Router v6）
- `apps/worker`（tsx watch，当前为 no-op stub）
- `packages/domain`（共享 enums + zod + RBAC + audit + AI lifecycle）

**中文路径必须用引号包裹**：`cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"`

## 已完成的阶段

- **Phase 0**（已提交 `15c6dda`）：工程脚手架、领域契约、Prisma schema（24 个模型）、RBAC 矩阵、审计分类、AI 输出生命周期、API skeleton。
- **Phase 1**（已验证未提交）：Web shell（AppShell/SideNav/TopBar）、设计 token 系统、DashboardPage 从真实 API 读数据、mock 登录、Vite proxy。
- **Phase 2**（已验证未提交）：5 个 domain 模块从 skeleton 501 替换为真实 Prisma handler——subjects/consent/visits/epro + 共享 auth/RBAC/audit helper。5 个 Web 页面接入真实 API。

## 前置条件

### 0.0 提交 Phase 1 + 2

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
git add -A
git commit -m "Phase 1+2: web shell, dashboard, core clinical workflows (subjects/consent/visits/epro)"
```

### 0.1 清理 lint warnings

删除以下 unused imports / stale eslint-disable（不要删除 Phase 0 domain 测试文件中的 unused schema exports——那些是 `enums.test.ts` 故意 import 来测试的）：

- `apps/api/src/server.ts:128` — 删除 `// eslint-disable-next-line no-console`（unused eslint-disable）
- `apps/web/src/routes/EproPage.tsx:38` — 删除 `import { apiPost }` （未使用）
- `apps/web/src/routes/SubjectDetailPage.tsx:21` — 删除 `import { Cell }` 如果未使用
- `apps/web/src/routes/RemoteVisitPage.tsx` — 删除 `remoteActive` 如果未使用
- `apps/web/src/routes/EConsentPage.tsx` — 删除 `import { Tag }` 如果未使用

验证：`npm run lint` 输出 0 errors, ≤3 warnings（domain 测试文件的 6 个 unused export 是故意的，保留）。

### 0.2 验证基线

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
npm run typecheck   # exit 0
npm run lint        # 0 errors
npm run test        # 79 passed
```

数据库要求：Docker 容器 `aic-dct-pg`（postgres:16, port 5432, password: password, db: aic_dct）。

```bash
docker start aic-dct-pg 2>/dev/null || docker run -d --name aic-dct-pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=aic_dct -p 5432:5432 postgres:16
cd apps/api
cp .env.example .env  # 确认 DATABASE_URL=postgresql://postgres:password@localhost:5432/aic_dct?schema=public
npm run db:migrate
npm run db:seed
```

---

## Phase 3 总览

Phase 3 实现智能化层：AI 方案解析、安全事件（AE/SAE）工作流、AI 风险监查、报告中心、文档与审计、AI 中台配置。

**拆为两轮执行**：
- **Round 1（Task 3.1-3.3）**：安全事件 + 风险监查 + 方案解析
- **Round 2（Task 3.4-3.6）**：报告中心 + 文档审计 + AI 配置

每轮完成后输出交付报告，等架构师审核通过再进入下一轮。

## 关键技术决策（已固化，不需要 AI 决定）

| 维度 | 选型 | 理由 |
|---|---|---|
| AI provider | **Mock provider**（确定性返回） | Phase 3 不接真实 AI API。worker 内置一个 `MockAIProvider` 类，按 prompt template 返回预定义的 JSON。后续 Phase 替换为真实 provider |
| Worker 运行时 | **不引入 BullMQ / Redis**。用 `apps/worker/src/` 内的 cron-style setInterval loop | Phase 3 worker 量很小（定时风险扫描 + 报告生成），BullMQ 是过度工程。Phase 4/5 再评估 |
| 路由文件组织 | **继续用 `apps/api/src/routes/*.ts`**，不创建 `apps/api/src/modules/` | 计划文件写了 `modules/` 但 Phase 2 已确立 `routes/` 的先例，保持一致 |
| Web 路由路径 | **`apps/web/src/routes/*Page.tsx`**，在 `App.tsx` 注册 | 计划文件写了 Next.js 路径但项目用 Vite + React Router，Phase 1/2 已确立先例 |
| 认证 | **继续用 `X-Actor-Id` header**，服务端从 DB 查 role | Phase 2 已确立的模式，不改动 |

## 已有的领域契约（不需要新建，直接用）

### 枚举 + 状态机（`packages/domain/src/enums.ts`）

| 枚举 | 状态 | 转换表 |
|---|---|---|
| `SafetyEventStatus` | Draft/InvestigatorReview/ConfirmedAE/ConfirmedSAE/Reported/FollowUp/Closed | `SAFETY_EVENT_TRANSITIONS` |
| `RiskStatus` | Open/Assigned/InProgress/PendingInvestigator/Resolved/Closed/Rejected | `RISK_STATUS_TRANSITIONS` |
| `ProtocolParseStatus` | Uploaded/Parsing/Parsed/ParseFailed/UnderReview/Effective/Superseded | 无转换表（需新建） |
| `ReportStatus` | Generating/Draft/UnderReview/Confirmed/Exported/Failed | 无转换表（需新建） |

### RBAC 权限（`packages/domain/src/rbac.ts`）

已有权限：`SafetyRead/Draft/Confirm/Report/Close`、`RiskRead/Assign/Resolve/Close`、`ProtocolParse/Activate`、`ReportRead/Generate/Confirm/Export`、`AuditRead/Export`。

### 审计关键动作（`packages/domain/src/audit.ts`）

`CRITICAL_AUDIT_PAIRS` 已覆盖：SafetyEvent Confirm/Report/Close、RiskSignal Confirm/Close/Reject、ProtocolActivate、MaskReveal。**不需要新增审计动作。**

### AI 输出生命周期（`packages/domain/src/ai.ts`）

`AIOutputKind` 含 9 种类型（ProtocolParse/RiskSignal/VisitSchedule 等）。`applyAIConfirmation()` 处理 Pending→Adopted/Rejected/EditedAdopted/NeedsInvestigatorConfirmation。`formatConfidence()` 输出不含医学定论词。

### Prisma 模型（`apps/api/prisma/schema.prisma`）

Phase 3 涉及的模型已全部在 Phase 0 建好：
- `ProtocolVersion` + `AIProtocolParseResult`（方案解析）
- `SafetyEvent` + `SafetyFollowUp`（安全事件）
- `RiskSignal` + `RiskHandlingRecord`（风险信号）
- `ReportDraft` + `ExportRecord`（报告 + 导出）
- `Document` + `DocumentVersion`（文档管理）
- `AIConfig` + `PromptTemplate` + `AICallLog` + `AIOutput`（AI 中台）

**不需要新增 Prisma 模型。不需要 schema migration。**

### Seed 数据（`apps/api/prisma/seed.ts`）

已有：1 个 Effective 协议、1 个 ConfirmedAE + 1 个 Draft SAE、3 个 RiskSignal（1 critical + 1 high + 1 medium）、1 个 Draft 报告、1 个 Document、1 个 AIConfig、1 个 PromptTemplate、2 个 AIOutput（1 Pending + 1 Adopted）、1 个 AICallLog、3 个 AuditEvent。

### 共享 helper（`apps/api/src/lib/auth.ts`）

`requireUser()` 从 `X-Actor-Id` header 读 userId，从 DB 查 role/projectId，不信任客户端 claim。`audit()` 写 AuditEvent 到 `afterValue`。`canUnmaskPII()` / `assertSubjectTransition()` 等守卫函数。

### API client（`apps/web/src/lib/api/client.ts`）

`apiGet<T>()` / `apiPost<T>()` / `apiPatch<T>()` 自动注入 `X-Actor-Id` / `X-Actor-Role` header。

---

## Round 1：安全事件 + 风险监查 + 方案解析

### Task 3.1 — AE/SAE 安全事件工作流

**API：替换 `apps/api/src/routes/safety.ts`**

端点：
- `GET /api/safety/events` — 列表（分页 + projectId/subjectId/status/severity 过滤）
- `GET /api/safety/events/:eventId` — 详情（含 followUps + 审计链）
- `POST /api/safety/events` — 新建 AE（CRC/CRA/PI 可创建）
- `POST /api/safety/events/:eventId/confirm` — PI 确认（Draft→InvestigatorReview→ConfirmedAE/ConfirmedSAE，PI-only）
- `POST /api/safety/events/:eventId/report` — 上报（ConfirmedSAE→Reported，PI-only，需 reason）
- `POST /api/safety/events/:eventId/follow-up` — 随访记录（PI/CRC）
- `POST /api/safety/events/:eventId/close` — 关闭（ConfirmedAE/ConfirmedSAE→Closed，PI-only，需 reason）

关键守卫：
- `SafetyEventStatus` 转换用 `canTransition(SAFETY_EVENT_TRANSITIONS, from, to)`
- SAE 关闭和上报需 `reason`（服务端校验，CRITICAL_AUDIT_PAIRS 已定义）
- `confirm` 和 `close` 只有 `SitePI` 和 `SponsorAdmin` 可以执行（`Permission.SafetyConfirm` / `Permission.SafetyClose`）
- 所有写操作写 AuditEvent

**Web：`apps/web/src/routes/SafetyEventsPage.tsx` + `SafetyEventDetailPage.tsx`**

原型参考：`Web后台UI设计/src/app/App.tsx` 的 `AESAEPage`（第 1504 行）。

页面结构：
- 列表页：事件 ID / 受试者 / 类型(AE/SAE) / 状态 / 严重程度 / SAE 标记 / 报告倒计时 / 责任人 / 操作
- 详情页：事件摘要 + 事件信息表 + 研究者判断面板 + 随访记录列表 + 审计链
- SAE 倒计时颜色：>24h 黄色 / <24h 橙色 / 过期红色（按计划第 87 行）
- AI 风险提示卡片（从 RiskSignal where objectType=SafetyEvent 读取，非硬编码）

路由：
- `App.tsx`：`/app/ae-sae` → `<SafetyEventsRoute />`，`/app/ae-sae/:eventId` → `<SafetyEventDetailRoute />`
- `SideNav.tsx`：移除 `ae-sae` 的 `phase: "Phase 2"` 标记

### Task 3.2 — AI 风险监查工作台

**API：替换 `apps/api/src/routes/risks.ts`**

端点：
- `GET /api/risks` — 列表（分页 + projectId/level/status/type/ownerId 过滤）
- `GET /api/risks/:riskId` — 详情（含 handling records + 审计链 + 关联 AIOutput）
- `POST /api/risks/:riskId/assign` — 分配（Open→Assigned，需 ownerId）
- `POST /api/risks/:riskId/start` — 开始处理（Assigned→InProgress；补齐主路径环）
- `POST /api/risks/:riskId/resolve` — 解决（InProgress/PendingInvestigator→Resolved，可选 reason）
- `POST /api/risks/:riskId/close` — 关闭（Resolved→Closed，需 reason，high/critical 级别强制）
- `POST /api/risks/:riskId/reject` — 拒绝（Open/Assigned→Rejected，需 reason）

关键守卫：
- `RiskStatus` 转换用 `canTransition(RISK_STATUS_TRANSITIONS, from, to)`
- high/critical 级别的 close 和 reject 需 `reason`（CRITICAL_AUDIT_PAIRS 已定义）
- assign 需要 `RiskAssign`；start/resolve 需要 `RiskResolve`；close/reject 需要 `RiskClose`
- **RiskClose 仅 CROPM**（SponsorAdmin 有 RiskResolve，无 RiskClose）
- 所有写操作写 AuditEvent + RiskHandlingRecord
- 主路径（HTTP）：Open → assign → start → resolve → close

**Web：`apps/web/src/routes/RiskMonitorPage.tsx`**

原型参考：`Web后台UI设计/src/app/App.tsx` 的 `RiskMonitorPage`（第 1621 行）。

页面结构：
- 风险概览卡片：总数 / 高风险 / 紧急 / 已处理 / 待处理 / 过期
- 风险等级分布（可复用 DashboardPage 的 recharts 饼图模式）
- 中心风险排名（复用 `/api/dashboard/center-risk`）
- 风险列表表格：编号 / 等级 / 类型 / 对象 / 触发原因 / AI 建议 / 责任人 / 截止日期 / 状态 / 操作
- 风险详情抽屉：来源 / 触发规则 / 关联数据 / AI 分析 / 推荐操作 / 处理历史 / 审计记录 / 操作按钮（分配/解决/关闭/拒绝）
- 风险颜色：low=绿 / medium=黄 / high=橙 / critical=红

路由：
- `App.tsx`：`/app/risk-monitor` → `<RiskMonitorRoute />`
- `SideNav.tsx`：移除 `risk-monitor` 的 `phase: "Phase 3"` 标记

### Task 3.3 — AI 方案解析工作台

**API：替换 `apps/api/src/routes/protocol.ts`（当前不存在，需创建）**

注意：Phase 0 的路由文件名是 `ai-config.ts` 不是 `protocol.ts`。方案解析路由应在 `apps/api/src/routes/protocol.ts` 中新建。

端点：
- `GET /api/protocol/versions` — 版本列表
- `GET /api/protocol/versions/:versionId` — 版本详情（含 parseResults + AIOutput）
- `POST /api/protocol/versions` — 上传新版本（SponsorAdmin/CROPM only，parseStatus=Uploaded）
- `POST /api/protocol/versions/:versionId/parse` — 触发 AI 解析（Uploaded→Parsing→Parsed）
- `POST /api/protocol/versions/:versionId/activate` — 激活（Parsed/UnderReview→Effective，需 reason，SponsorAdmin only）
  - 激活时将上一个 Effective 版本改为 Superseded
  - 激活后版本不可变（immutable）

关键守卫：
- `ProtocolParseStatus` 需要新建转换表 `PROTOCOL_PARSE_TRANSITIONS`（加到 `packages/domain/src/enums.ts`）：
  ```typescript
  export const PROTOCOL_PARSE_TRANSITIONS: Record<ProtocolParseStatus, ProtocolParseStatus[]> = {
    Uploaded: ["Parsing"],
    Parsing: ["Parsed", "ParseFailed"],
    Parsed: ["UnderReview"],
    ParseFailed: ["Parsing"],
    UnderReview: ["Effective"],
    Effective: ["Superseded"],
    Superseded: [],
  };
  ```
- `activate` 需 `Permission.ProtocolActivate`，需 `reason`
- 激活写 AuditEvent（CRITICAL_AUDIT_PAIRS 已定义 ProtocolActivate）
- AI 解析结果状态用 `HumanConfirmationStatus`（Pending→Adopted/Rejected）

**Mock AI Provider（`apps/worker/src/providers/mock-ai-provider.ts`）**

```typescript
export interface AIProvider {
  parseProtocol(documentUrl: string): Promise<{
    fields: Record<string, unknown>;
    confidence: number;
  }>;
  scanRisk(subjectTimeline: unknown): Promise<{
    suggestion: string;
    confidence: number;
  }>;
}
```

Mock 实现返回确定性 JSON（基于 input hash 选预定义响应），不调真实 AI API。

**Worker：`apps/worker/src/index.ts`**

替换 no-op stub，实现：
- 监听 `protocol.parse` job（API 通过 DB 标记 `parseStatus=Parsing`，worker 定时扫描并执行）
- 监听 `risk.scan` job（定时扫描高风险受试者）
- 用 setInterval（5 分钟一次），不引入 BullMQ/Redis

**Web：`apps/web/src/routes/ProtocolPage.tsx`**

原型参考：`Web后台UI设计/src/app/App.tsx` 的 `ProtocolPage`（第 919 行）。

页面结构：
- 文件信息区：方案名称 / 版本 / 上传时间 / 上传人 / AI 解析状态 / 人工确认状态
- 左侧文档大纲 / 来源预览
- 右侧 AI 解析结果 Tabs：项目摘要 / 入排标准 / 访视计划 / 访视任务 / 时间窗 / 远程/现场建议 / 安全风险点 / 数据采集字段
- 标准表格：编号 / 类型 / 原文 / 结构化结果 / 置信度 / 确认状态 / 操作
- 来源证据抽屉
- "全部确认并生效" Modal（需确认备注）
- 激活后版本不可变

路由：
- `App.tsx`：`/app/protocol` → `<ProtocolRoute />`
- `SideNav.tsx`：移除 `protocol` 的 `phase: "Phase 3"` 标记

---

## Round 2：报告中心 + 文档审计 + AI 配置

### Task 3.4 — 报告中心

**API：替换 `apps/api/src/routes/reports.ts`**

端点：
- `GET /api/reports` — 列表（分页 + projectId/type/status 过滤）
- `GET /api/reports/:reportId` — 详情
- `POST /api/reports` — 生成草稿（status=Generating，触发 worker 生成）
- `POST /api/reports/:reportId/confirm` — 确认（UnderReview→Confirmed，需权限 `ReportConfirm`）
- `POST /api/reports/:reportId/export` — 导出（Confirmed→Exported，需权限 `ReportExport`，需 reason，创建 ExportRecord）

关键守卫：
- 导出需 `reason` + 创建 `ExportRecord`（包含 objectIds / format / reason）
- 报告不能在未经人工确认前标记为正式
- AI 生成草稿需标注"AI 草稿"标签

**Web：`apps/web/src/routes/ReportsPage.tsx`**

原型参考：`ReportsPage`（第 1998 行）。

### Task 3.5 — 文档管理与审计日志

**API：替换 `apps/api/src/routes/documents.ts` + 替换 `apps/api/src/routes/audit.ts`**

文档端点：
- `GET /api/documents` — 列表（分页 + projectId/category 过滤）
- `POST /api/documents` — 创建（上传文档，创建 Document + DocumentVersion）
- `GET /api/documents/:documentId/versions` — 版本列表
- `POST /api/documents/:documentId/versions` — 新版本（创建 DocumentVersion，更新 Document.currentVersionId）

审计端点：
- `GET /api/audit/events` — 列表（分页 + projectId/actorUserId/objectType/action/date 过滤）
- `POST /api/audit/exports` — 导出审计日志（需权限 `AuditExport`，需 reason，创建 ExportRecord）

关键守卫：
- 只读角色（Auditor/Regulator）不能修改文档
- 审计导出需 reason + 创建 ExportRecord

**Web：`apps/web/src/routes/DocumentsAuditPage.tsx`**

原型参考：`DocumentsPage`（第 2041 行）。

页面结构：Tab 切换（文档 / 审计日志 / AI 输出记录 / 导出记录）
- 文档 Tab：类别树 + 文档列表 + 版本记录
- 审计日志 Tab：表格（时间 / 操作人 / 角色 / 对象 / 操作类型 / 前值 / 后值 / IP / 设备 / 原因）
- 过滤：操作人 / 对象 / 操作类型 / 日期 / 项目 / 受试者

路由：
- `App.tsx`：`/app/documents` → `<DocumentsAuditRoute />`
- `SideNav.tsx`：移除 `documents` 的 `phase: "Phase 2"` 标记

### Task 3.6 — AI 中台配置

**API：替换 `apps/api/src/routes/ai-config.ts`**

端点：
- `GET /api/ai-config/configs` — AI 能力配置列表
- `PUT /api/ai-config/configs/:configId` — 更新配置（provider/model/temperature/maxTokens/enabled）
- `GET /api/ai-config/prompts` — Prompt 模板列表
- `POST /api/ai-config/prompts` — 创建新版本（创建 PromptTemplate，记录版本）
- `GET /api/ai-config/call-logs` — AI 调用日志列表（分页 + projectId/model/date 过滤）
- `GET /api/ai-config/outputs` — AI 输出审核队列（status=Pending 的 AIOutput 列表）
- `POST /api/ai-config/outputs/:outputId/adopt` — 采纳（Pending→Adopted，需权限）
- `POST /api/ai-config/outputs/:outputId/reject` — 拒绝（Pending→Rejected，需 reason）

关键守卫：
- Prompt 模板变更创建版本化记录 + 审计事件
- AI 调用日志包含 time/module/caller/project/input summary/output summary/model/prompt version/human confirmation state
- AI 输出采纳/拒绝用 `applyAIConfirmation()`

**Web：`apps/web/src/routes/AIConfigPage.tsx`**

原型参考：`AIConfigPage`（第 2102 行）。

页面结构：Tab 切换（能力概览 / 知识库 / Prompt 模板 / 模型配置 / AI 输出审核 / 调用日志 / 风险规则）
- 能力概览：能力列表 + 模型标签 + 月度调用量 + 能力开关
- Prompt 模板：代码 / 版本 / 内容 / 变量 / 输出类型
- 调用日志：时间 / 模块 / 调用者 / 项目 / 输入摘要 / 输出摘要 / 模型 / Prompt 版本 / 人工确认状态 / 操作
- AI 输出审核队列：Pending 的 AIOutput 列表 + 采纳/拒绝操作

路由：
- `App.tsx`：`/app/ai-config` → `<AIConfigRoute />`
- `SideNav.tsx`：移除 `ai-config` 的 `phase: "Phase 3"` 标记

---

## 执行原则

1. **每完成一个 Task 立即跑验证命令**，通过后再做下一个。
2. **不改动 Phase 0/1/2 已通过的代码**，除非是 SideNav 移除 phase 标记。
3. **不动 `Web后台UI设计/` 目录**。
4. **不引入新依赖**（BullMQ/Redis/真实 AI SDK 等都不引入）。
5. **所有数据从 Prisma seed 读**，不硬编码 mock 数组。
6. **所有状态转换用 `canTransition()` + 服务端校验**。
7. **所有关键写操作写 AuditEvent**。
8. **AI 输出永远标注"AI 建议"标签，不含医学定论词**。
9. **路由文件路径用 `apps/api/src/routes/*.ts`**，Web 页面用 `apps/web/src/routes/*Page.tsx`。
10. **认证用 `X-Actor-Id` header + `requireUser()` helper**。

## 每轮验收命令

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
npm run typecheck   # exit 0
npm run lint        # 0 errors（warnings ≤ 10）
npm run test        # 全部通过
```

API smoke test（用 Fastify `app.inject()` 测试所有新端点）：
```bash
cd apps/api
DATABASE_URL="postgresql://postgres:password@localhost:5432/aic_dct?schema=public" npx tsx -e "
import { buildServer } from './src/server.js';
const app = await buildServer();
// 登录获取 actorId
const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{email:'sponsor@aic-dct.test',password:'test'} });
const session = JSON.parse(login.body).session;
const hdr = { 'X-Actor-Id': session.userId, 'X-Actor-Role': session.role };
// 测试新端点
const res = await app.inject({ method:'GET', url:'/api/safety/events', headers:hdr });
console.log('GET /api/safety/events ->', res.statusCode, res.body.slice(0,200));
await app.close();
"
```

## Architect Review Gate（不通过则拒绝）

1. **AI 输出可绕过人工确认** → 拒绝
2. **方案激活修改了前一个 Effective 版本的数据**（而不是改为 Superseded）→ 拒绝
3. **SAE 关闭缺少 reason / 权限 / 审计** → 拒绝
4. **报告导出缺少确认和导出记录** → 拒绝
5. **AI 调用日志缺少 model 或 prompt version** → 拒绝
6. **Web 页面丢弃原型的交互模型（无文档原因）** → 拒绝
7. **硬编码 mock 数据替代 Prisma 查询** → 拒绝
8. **状态转换仅在 UI 校验、服务端无校验** → 拒绝

## 输出格式

每轮完成后输出：

```markdown
## Scope Completed
- [module or phase delivered]

## Files Changed
- `path/to/file`: reason

## Verification Performed
- `command`: result

## API Smoke Test Results
- `GET /api/safety/events -> 200`: sample response
- ...

## Known Limits
- [concrete limit, if any]

## Review Focus
- [specific areas the architect should inspect]
```
