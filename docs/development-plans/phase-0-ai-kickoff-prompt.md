# Phase 0 AI Kickoff Prompt

你是本项目的开发执行 AI。现在开始开发 AIC-DCT 远程智能临床试验操作系统。

## 你的任务

执行 Phase 0：搭建工程基础、领域契约、数据模型、RBAC、审计、AI 输出生命周期和 API 合同。

本阶段目标不是做完整 UI 页面，而是把后续所有 AI 能稳定开发的工程底座搭好。

## 必读文件

先阅读以下文件，不要跳过：

1. `AIC-DCT UI Design Document.pdf`
2. `Web后台UI设计/README.md`
3. `Web后台UI设计/src/app/App.tsx`
4. `Web后台UI设计/src/styles/theme.css`
5. `docs/ui/web-prototype-inventory.md`
6. `docs/architecture/aic-dct-architecture-development-roadmap.md`
7. `docs/development-plans/ai-execution-review-protocol.md`
8. `docs/development-plans/phase-0-foundation.md`
9. `docs/superpowers/plans/2026-07-09-aic-dct-implementation.md`

## 关键原则

- `Web后台UI设计/` 是 Web 后台 UI 的视觉和交互基线，不要重画一套后台。
- Phase 0 先搭工程底座，不要急着大规模实现页面。
- 后续 Web UI 要产品化拆分 `Web后台UI设计/src/app/App.tsx`，不是丢弃它。
- PDF 是产品/交互/合规意图，Web 原型是后台 UI 的实际视觉基线。
- Mock 数据只能作为 seed/API shape 参考，不能成为最终页面的数据来源。
- AI 输出必须有来源、模型、提示词版本、生成时间、置信度表达、人工确认状态和审计记录。
- 临床关键操作必须有服务端校验、权限判断和审计留痕。
- 受试者敏感信息默认脱敏，查看完整信息必须权限控制并写审计日志。
- SAE、高风险关闭、敏感数据导出、AI 内容采用、方案生效等关键动作必须要求确认，必要时要求原因。

## 推荐技术方向

如果当前目录还没有正式工程，可以采用以下架构：

- Monorepo workspace。
- Web：React + TypeScript + Tailwind CSS + shadcn/Radix + lucide-react + Recharts。
- API：TypeScript 后端，Fastify 或 NestJS 均可。
- Worker：TypeScript worker，用于 AI 解析、风险评分、报告生成、超时检查。
- DB：PostgreSQL + Prisma。
- Queue：BullMQ + Redis。
- Shared domain：独立 `packages/domain`，放 enums、zod schema、共享类型。

如果你选择 Next.js，也可以，但必须解释为什么，并保持对 `Web后台UI设计/` 的可迁移性。

## Phase 0 必须交付

按照 `docs/development-plans/phase-0-foundation.md` 完成，至少包括：

1. 工程脚手架。
2. 根目录脚本：`dev`、`build`、`lint`、`typecheck`、`test`、`db:migrate`、`db:seed`。
3. `packages/domain` 共享领域类型和状态枚举。
4. Prisma schema v0。
5. seed demo study。
6. RBAC matrix 文档。
7. Audit taxonomy 文档。
8. AI output lifecycle 文档。
9. API contract 初稿。
10. 基础测试：领域 enum/schema、权限判断、审计 helper、API error shape。

## 必须包含的核心状态枚举

至少实现这些 enum，并通过共享包导出：

- `ProtocolParseStatus`: `Uploaded`, `Parsing`, `Parsed`, `ParseFailed`, `UnderReview`, `Effective`, `Superseded`
- `HumanConfirmationStatus`: `Pending`, `Adopted`, `EditedAdopted`, `Rejected`, `NeedsInvestigatorConfirmation`
- `SubjectStatus`: `PreScreening`, `Consenting`, `Screening`, `Enrolled`, `Active`, `Completed`, `Withdrawn`, `ScreenFailed`
- `VisitStatus`: `NotStarted`, `Scheduled`, `InProgress`, `SubmittedForPI`, `Completed`, `Missed`, `OutOfWindow`, `Deviation`
- `ConsentStatus`: `NotStarted`, `Reading`, `ComprehensionPending`, `SubjectSigned`, `InvestigatorSigned`, `Completed`, `ReConsentRequired`, `Withdrawn`
- `QuestionnaireStatus`: `Scheduled`, `InProgress`, `Submitted`, `Missed`, `Late`, `Reviewed`
- `SafetyEventStatus`: `Draft`, `InvestigatorReview`, `ConfirmedAE`, `ConfirmedSAE`, `Reported`, `FollowUp`, `Closed`
- `RiskLevel`: `Low`, `Medium`, `High`, `Critical`
- `RiskStatus`: `Open`, `Assigned`, `InProgress`, `PendingInvestigator`, `Resolved`, `Closed`, `Rejected`
- `ReportStatus`: `Generating`, `Draft`, `UnderReview`, `Confirmed`, `Exported`, `Failed`

## 必须建模的核心领域

Prisma schema 至少覆盖：

- Project / Study
- Site / Center
- User
- Role assignment
- Subject
- Subject identity / masked sensitive identity
- Protocol version
- AI parsed protocol result
- Consent document
- Consent task
- Signature record
- Visit
- Visit task
- Remote visit record
- Questionnaire template
- Questionnaire response
- Safety event
- Safety follow-up
- Risk signal
- Risk handling record
- Drug shipment
- Sample transfer
- Report draft
- Export record
- Document
- Document version
- AI config
- Prompt template
- AI call log
- AI output
- Audit event

## 审计要求

实现审计 helper，并在测试中证明关键动作会写 audit event。

Audit event 至少包含：

- actor user id
- actor role
- project id
- object type
- object id
- action
- before value
- after value
- reason
- ip/device 字段预留
- timestamp

## 权限要求

实现 RBAC helper，并写测试覆盖：

- 允许访问。
- 拒绝访问。
- 需要审计的访问。
- 普通角色不能查看完整 PII。
- 审计/监管只读角色不能执行 mutation。

## API 错误格式

统一错误格式：

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {},
  "requestId": "request-id"
}
```

## 验收命令

完成后必须能运行：

```bash
npm run lint
npm run typecheck
npm run test
```

如果某个命令因为依赖、环境、数据库或网络限制不能运行，要明确说明原因、失败输出、你已经做了什么替代验证。

## 禁止事项

- 不要删除或覆盖 `Web后台UI设计/`。
- 不要把 `Web后台UI设计/src/app/App.tsx` 直接当最终生产文件继续堆代码。
- 不要绕过 RBAC、审计、脱敏、AI 人工确认。
- 不要把 AI 判断写成医学最终结论。
- 不要用纯前端 local state 实现临床关键状态流转。
- 不要把页面 Mock 数据当成最终数据源。
- 不要为了让 demo 好看而牺牲服务端数据模型。

## 交付格式

完成后按以下格式回复：

```markdown
## Scope Completed

- [完成的范围]

## Files Changed

- `path/to/file`: 修改原因

## How To Run

- `command`

## Verification Performed

- `command`: 结果

## Known Limits

- [明确限制，没有就写 None]

## Review Focus

- [请架构审核重点看的地方]
```

## 最终提醒

本项目的正确顺序是：

1. 领域契约和工程底座。
2. 把现有 Web 后台原型产品化拆分。
3. 接真实 API 和 seed 数据。
4. 补齐临床工作流、AI 风险、审计、权限和合规。

现在只执行 Phase 0，不要越界大规模开发 UI。

