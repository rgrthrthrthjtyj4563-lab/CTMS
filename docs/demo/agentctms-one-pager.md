# AgentCTMS MVP 投资人 1-pager

> 一页讲清楚：和传统 CTMS 的差别、已经能做什么、接下来怎么走。

## 1. 一句话定位

> **不是让 CRA 多填一张表，而是把一次现场录入变成 PM 可审核、QA 可追溯的业务结果。**

## 2. 传统 CTMS vs AgentCTMS

| 维度 | 传统 CTMS | AgentCTMS MVP |
|---|---|---|
| 现场录入 | 8 张表 + 多次切换 | 一段话/一张图/一段语音 |
| 业务动作 | 分散在不同模块 | 同一输入自动产出多类候选 |
| AI 输出 | 多以聊天回复出现 | 全部进入可确认的业务动作包 |
| 合规边界 | 事后才发现遗漏 | 每个动作标"候选"，永不绕过人工 |
| QA 追溯 | 报表 + 间接证据 | 一键展开 input/attachment/audit 三层 |
| 受试者/ePRO | 必修 | 明确不做 |

## 3. MVP 已实现能力（5 分钟可演示）

- **登录与上下文**：CRA 一登录即落到当天 IMV，3 个角色（CRA/PM/QA）。
- **工作台**：今日计划 IMV / 待处理行动包 / PM 退回原因 一屏展示。
- **IMV 简报**：项目、中心、历史 Issue 与重点。
- **IMV 进行中**：文字 / 语音 / 拍照 / 文件 四类输入；可视化时间线。
- **行动包**：1 访视记录 + 1 工时 + N Issue + 1 Risk 候选 + 1 CAPA 候选 + N 任务 + N 证据 + 1 报告草稿 + N 跟进项。
- **逐项确认**：候选/草稿/待确认/已确认 四态可视化，CRA 可编辑或删除。
- **PM 审核**：通过/退回，**退回原因自动回流到 CRA 工作台 subtitle**。
- **审计与来源**：input/attachment/audit 全程记录，可视；脏字段 `ACTION_CONFIRMED_FALLBACK` 留痕。

## 4. 关键技术护栏（投资人可选看）

- **LLM 防爆**：`normalizeGeneratedPack` + `ACTION_CONFIRMED_FALLBACK` 双护栏；
- **工程测试**：47/47 单测 + 46/46 e2e IMV 主流程；
- **演示稳定**：关键路径走规则解析；MODEL 路径兜底；e2e 注入覆盖率 100%；
- **合规三层**：候选标识 → 来源追溯 → 审计一屏（详见 [compliance-narrative.md](./agentctms-compliance-narrative.md)）。

## 5. 接下来怎么走（路线，6 段叙事）

1. **IMV → 全 MonitoringVisit**：覆盖 SIV/COV，复用同套 ActionPack 协议；
2. **CRA → PM/QA 协同**：QA 退回 + 风险升级，CAPA 真闭环；
3. **APP → Web 后台**：项目、中心、文档、报表、权限（不做全量 CTMS）；
4. **单项目 → 多项目运营**：工时、费用、周报、绩效；
5. **CRO/SMO → 医院机构包**：伦理、人遗、药械、院内 HIS；
6. **现场 Agent → 完整 AgentCTMS**：多专业 Agent 协同，**永远保留人工确认**。

## 6. 商业化切入点

- 第一刀：CRO/CMO/CRA 派遣公司；替换其 IDA/RA/QC 录入环节；
- 第二刀：药企自营团队的中型项目（10–80 中心，1–3 名 PM/QA）；
- 第三刀：临床机构院内 IMV/SIV 的标准化；
- **兜底承诺**：永远把 AI 输出做成候选，把"通过/退回"留给人。

---

> D0 演示脚本：[agentctms-mvp-demo-script.md](./agentctms-mvp-demo-script.md)
> D3 合规叙事：[agentctms-compliance-narrative.md](./agentctms-compliance-narrative.md)
> 演示账号：CRA 13800138001 / PM 13800138002 / QA 13800138003 — 密码 password
