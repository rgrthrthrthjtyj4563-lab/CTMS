# IMV 行动包 — 期望类型清单

> 投资人演示 / `test:e2e:imv` / `agentctms-mvp-demo-script.md` 共用同一份"最低期望类型"。  
> 来源：`apps/api/scripts/e2e-imv-mainflow.ts` + `docs/demo/agentctms-mvp-demo-script.md`。

## 1. 演示固定口播输入

```
今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，
发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。
CRC小王承诺周五前补齐，PI下周一复核。
我已经上传知情同意和药物管理文件照片。
```

> 此输入 = e2e 默认 `ACCEPTANCE_INPUT`。录屏与冒烟均建议复用，保证可重复。

## 2. 期望出现的 action 类型（rules 路径下稳定产出）

| 类型                  | 来源规则段                                | 出现条件 | 备注 |
|-----------------------|--------------------------------------------|----------|------|
| `MONITORING_VISIT_RECORD` | `parseWithRules` 顶部固定 1 条          | 必出 | 访视起止/核对数/发现项 |
| `HOURS`               | 匹配 `时间-时间` → `HOURS`               | 必出（输入含 `9:10到17:40`）| durationHours 由规则计算 |
| `ISSUE`               | 命中"未签字"或"温度记录缺失"             | 必出 ≥1（输入含两条线索即 2 条） | HIGH/CRITICAL 自动 `requiresIndividualConfirm` |
| `RISK_CANDIDATE`      | 出现 DOCUMENTATION 或 DRUG_ACCOUNTABILITY | 通常出 | `requiresIndividualConfirm=true` |
| `CAPA_CANDIDATE`      | `issues.length >= 2`                      | 通常出 | `requiresIndividualConfirm=true` |
| `TASK`                | 含"承诺/周五前补齐/下周一复核"           | 通常出 ≥1 | 来源规则：`extractTasks` |
| `EVIDENCE`            | `ctx.attachments` 每张 1 条               | 视附件而定 | 输入含"已上传…照片" 时通过附件触发 |
| `REPORT_DRAFT`        | 固定尾部 1 条                             | 必出 | sections: visit_info/work_completed/findings/actions |
| `FOLLOW_UP_ITEM`      | 每个 issue 1 条                          | 必出 ≥1 | 含建议措辞与负责人 |

## 3. e2e 兜底注入（MODEL 路径下若缺则注入）

> 演示主路径建议用 **DEMO_MODE=1**（强制 rules），因此不会触发以下注入分支；  
> 此处列出仅作为对 MODEL 路径的覆盖说明。

- `TASK`：当 `pack.items` 不含 TASK 时注入"补齐 03 号签字"
- `REPORT_DRAFT`：当 `pack.items` 不含 REPORT_DRAFT 时注入空标题/非数组 sections（验证 normalize）

## 4. 确认/提交环节需命中的 dirty 字段（断言通过 = 全绿）

| 类型                  | 故意"脏"字段 | 期望行为 |
|-----------------------|----------------|----------|
| `TASK`                | `dueDate: '补齐'` | confirm 200，落库时 `ACTION_CONFIRMED_FALLBACK` |
| `HOURS`               | `date: '不是日期'` | confirm 200，normalize 抹平 |
| `ISSUE`               | `targetDate: '补齐'`、severity `'Major'` | confirm 200 |
| `FOLLOW_UP_ITEM`      | `dueDate: '下周某天'` | confirm 200 |
| `REPORT_DRAFT`        | `sections: 'not-an-array'`、`title: ''` | confirm 200，normalize 抹平 |
| `MONITORING_VISIT_RECORD` | `actualStartTime/EndTime: '坏时间'` | confirm 200 |

## 5. e2e 必现断言（= 演示稳定通过）

```
items.length >= 5
items 含 TASK
items 含 REPORT_DRAFT
submit → visit.status = PENDING_PM_REVIEW
CRA todos: TASK → href 含 action-pack?packId={id}
PM todos: ACTION_PACK → href 含 mode=review
PM approve → visit.status = APPROVED
audit 含: VISIT_STARTED + AI_GENERATED(_IDEMPOTENT) + PACK_SUBMITTED + PM_REVIEW + ACTION_CONFIRMED_FALLBACK
hours ≥1, issues ≥1, followUps ≥1, reportDraft ≥1 section
```

## 6. 录屏/E2 共用结论

- 主路径期望 5+ 类 action 出现（监查记录、工时、Issue、Task、报告草稿 必出）；
- 即使后续 MODEL 路径调整，**rules 路径 + DEMO_MODE=1** 必须保持上述输出；
- 任何修改 `packages/domain` 或 `apps/api/src/lib/normalize*` 的 PR 都必须重跑 `pnpm --filter @clinical/api test` 与 `test:e2e:imv`，本清单作为对照表。