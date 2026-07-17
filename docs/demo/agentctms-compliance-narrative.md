# AgentCTMS MVP 合规叙事（投资人 1 屏讲清版）

- 版本：v1（Demo Freeze 用）
- 目的：用一张 1 页/3 屏，向投资人/合规评审讲清楚"AI 只产候选、正式动作永远人工确认、可全程追溯"的边界与证据。

## 1. 30 秒承诺（一句话）

> AgentCTMS 中，AI 生成的所有内容默认都是"候选/草稿/待确认"。任何会改变项目基线、Issue 状态、工时入账、报告章节或运营决策的写入，都必须由 CRA/PM 人工确认或审核；Agent 不会自动关闭 Issue、不会写正式记录、不会跳过 PM。

## 2. 屏幕 1 — 候选标识（Candidate Tag）

页面：APP 行动包每一项右上角。

| 标识 | 含义 | 谁来翻牌 |
|---|---|---|
| `候选 / CANDIDATE` | AI 第一次产出的建议，未入业务实体 | CRA 逐项确认 |
| `草稿 / DRAFT` | AI 写的报告段落，未生效 | CRA 确认 / PM 审核 |
| `待确认 / PENDING_CONFIRM` | 待人工二次确认 | CRA 编辑或确认 |
| `已确认 / CONFIRMED` | 人工拍板，生成 HoursRecord / Issue / Todo | 进入 PM 审核流 |
| `已退回 / RETURNED` | PM 退回，附原因 | CRA 重新编辑 |
| `已通过 / APPROVED` | PM 通过，visit 状态变 APPROVED | 不可逆 |

关键事实：
- `RISK_CANDIDATE` / `CAPA_CANDIDATE` 强制 `requiresIndividualConfirm=true`，永远不会被自动落库；
- CRA 可"确认 / 编辑 / 删除"三选一，无任何"一键全部自动通过"路径；
- AI 不会创建 `Issue.status='CLOSED'`、不会写 `HoursRecord.status='APPROVED'`、不会越权关 CAPA。

## 3. 屏幕 2 — 来源可追溯（Source Provenance）

页面：行动包每项详情，下方"来源"区块。

每条 `ActionItem.sourceIds` 写明两类 ID：
- `inputIds`：触发该动作的 `VisitInput`（文字/语音/照片/文件）；
- `sources[]`：原始摘录（excerpt + field），可定位到现场原文的某个字段；
- `attachmentIds`：作为依据的附件 ID。

讲法（CRA 点击"查看详情" → 翻到来源 → 念给 PM）：
1. 这条 Issue 的 title 来自我刚才那条输入："03号受试者原始记录未签字"；
2. responsiblePerson 来自那句话里的"CRC 小王"；
3. 药房温度记录缺失对应的附件是这张照片；
4. AI 没编任何项目/中心/人员/时间。

工程护栏：
- `parseWithRules` 与 `normalizeGeneratedPack` 强制按 `AiContext` 上下文拼 ID，绝不允许编造 inputId/attachmentId；
- `e2e-imv-mainflow` 锁定 input→action 链路；
- 工程铁律："数据层可信"是 A–C 已收口的能力，任何 AI 都不允许写入未在原文出现过的事实。

## 4. 屏幕 3 — 审计一屏（Audit Trail）

页面：访视详情底部"审计"区块，或后端 `/api/audit/visit/:visitId/full`。

固定可见的事件类型（覆盖 D0/D1/D2 演示全程）：
- `VISIT_STARTED`：CRA 现场点开始；
- `INPUT_CREATED` / `INPUT_EDITED` / `INPUT_VOIDED`：现场录入、可被编辑、可作废，理由必填；
- `AI_GENERATED` / `AI_GENERATED_IDEMPOTENT`：行动包生成（含 origin=MODEL/RULE）；
- `ACTION_CONFIRMED` / `ACTION_CONFIRMED_FALLBACK`：CRA 逐项确认，后者记录被清理掉的脏字段（如 `"dueDate":"补齐"`）；
- `PACK_SUBMITTED` / `PM_REVIEW`：提交与审核节点；
- `HOURS_RECORDED` / `ISSUE_RECORDED` / `FOLLOW_UP_CREATED` / `REPORT_DRAFT_SAVED`：可审计的副作用；
- `REVIEW_APPROVED` / `REVIEW_RETURNED`：PM 通过/退回 + 退回原因。

讲法（演示最后阶段切到审计页）：
- "刚才 CRA 现场的所有动作、AI 的所有建议、CRA 的所有确认、PM 的退回原因都在这里，按时间排好序。"
- "D5 录屏里我们能在一块屏幕内完整追溯一次 IMV。"

## 5. 三条不可逾越的合规红线（演示时主动声明）

1. **AI 不写正式记录**：所有 AI 动作的 `data` 都是候选，CRA 不确认，DB 不会变。
2. **AI 不自动关 Issue**：Issue 默认 `OPEN` / `DRAFT_CANDIDATE`，关单永远走人工。
3. **PM 一票否决**：任何 CRA 提交包都可被 PM 退回，退回原因自动回流到 CRA 工作台（已有 subtitle 单测兜底）。

## 6. 与监管/合规审查的对应（一句接一句）

| 合规审查关心 | AgentCTMS 的回答 |
|---|---|
| AI 是否会篡改基线 | 否，所有 AI 输出均为候选/草稿 |
| 谁对最终记录负责 | CRA 确认 + PM 审核两段式人工 |
| 来源是否可溯 | input / attachment / audit 三层证据链 |
| 撤回/作废是否保留 | INPUT_EDITED / VOIDED 必填理由，audit 全留 |
| Role-based access | CRA / PM / QA 三角色，CAPA 与 QA 流程仅作路线 |
| 数据安全 | 不涉及 PHI 主体；受试者 APP/ePRO 明确不做 |
| 离线/同步 | visitInput 有 clientInputId + syncStatus，冲突解决另立页 |

## 7. 路线图上的合规升级（D5 1-pager 接续）

1. **IQ/OQ/PQ 验证**：MVP 之后接入 GAMP5 流程；
2. **电子签名与时间戳**：CRA/PM 确认动作接 21 CFR Part 11；
3. **完整审计导出**：PDF + JSON 双格式，按 GCP 要求保留 10 年；
4. **多级审核**：QA → 部门负责人 → 医学监查，三级可配；
5. **AI 红队**：上线前完成 RAI 评估（偏差/幻觉/对外发散）。

---

## D3 checklist

- [x] 屏幕 1 候选标识规则落表
- [x] 屏幕 2 来源追溯数据点落表
- [x] 屏幕 3 审计事件类型枚举
- [x] 三条合规红线声明
- [x] 合规审查对应表
- [x] 路线图升级路径
