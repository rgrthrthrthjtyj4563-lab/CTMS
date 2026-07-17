# PROJECT_STATE

## 当前产品定位

当前项目的产品主线是：

**面向 CRA 的 AI 临床运营 APP V1。**

本项目当前不再以旧的受试者 ePRO、患者随访、SubjectVisit 窗口期管理或完整传统 CTMS 后台为主线。

V1 的核心业务对象是 `MonitoringVisit / IMV`，核心用户是 CRA，核心价值是帮助 CRA 在中心监查访视过程中更快完成现场记录、AI 整理、行动包确认、Issue / 待办 / 工时 / 报告草稿闭环。

一句话定义：

> 这是 CRA 做 IMV 时使用的 AI 工作助手，不是完整 CTMS，也不是患者端 ePRO。

## 当前主流程

APP V1 的主故事是：

1. CRA 登录
2. 进入工作台
3. 查看今日 IMV
4. 开始访视
5. 在现场页记录文字、语音、照片、文件
6. 结束访视
7. 进入访视总结页
8. 查看 AI 行动包
9. 确认 / 编辑 / 删除行动项
10. 提交给 PM
11. PM 审核或退回
12. 形成待办、Issue、工时、报告草稿闭环

## 当前代码状态

当前工作区已经不是空白项目。APP V1 主体代码、API、移动端页面、需求文档、设计基线都已经存在。

但当前状态仍是 **WIP 开发基线**，不是正式 V1 release。

当前已知状态：

| 检查项 | 状态 |
|---|---|
| 产品方向 | 已转为 CRA AI 临床运营 APP V1 |
| APP 主体页面 | 已存在，需要主流程验收 |
| API 主体能力 | 已存在，需要测试收口 |
| 设计基线 | `AI临床运营APP设计/` |
| 需求文档 | `docs/requirements/` |
| lint | 已通过过一次 |
| typecheck | 已通过过一次 |
| build | 已通过过一次 |
| mobile smoke | 已通过过一次 |
| API test | 仍有 Prisma / Node 环境问题需要修复 |
| 人工完整验收 | 尚未完成 |

## 当前正式基线说明

从现在开始，后续 AI 开发应以当前 APP V1 方向为基线。

优先参考：

1. `PROJECT_STATE.md`
2. `AI_TASKS.md`
3. `DEVELOPMENT_PLAN.md`
4. `docs/requirements/ai-clinical-operations-app-v1-requirements.md`
5. `docs/requirements/ai-clinical-operations-app-ui-requirements.md`
6. `AI临床运营APP设计/`

如果旧 Web 后台、旧 ePRO、旧 SubjectPortal 与 APP V1 冲突，以 APP V1 为准。

## 当前最高优先级

当前不是继续堆新功能，而是先收口：

1. 建立清晰开发基线
2. 固定 AI 分工
3. 打通 IMV 主流程
4. 修复 API 自动测试
5. 再做时间提醒 M0-M1

## 暂停开发范围

在 IMV 主流程验收通过前，暂停以下内容：

- 秒级倒计时
- 大型时间提醒 UI 改造
- 患者随访倒计时
- ePRO 倒计时
- SubjectVisit 窗口期管理
- 完整传统 CTMS 日历
- Web 后台大重构
- 新角色扩展
- 多个 AI 同时改工作台 / IMV 现场页 / 总结页 / 行动包

## 时间提醒需求状态

倒计时与时间提醒需求已经纳入项目规划，但它属于 **Phase 2**。

它的产品定义是：

> 不做秒级倒计时，不做压迫式计时器，而是做业务时间压力提醒：现在该做什么、什么快到期、什么已逾期。

覆盖范围：

1. 访视前提醒
2. 访视中低噪音提示
3. 访视后行动项 / Issue 截止管理

执行前置条件：

- IMV 主流程能走通
- 结束访视能进入总结页
- 行动包能确认提交
- 待办点击有明确响应
- AI 分工文件已建立
- 当前 WIP 基线已保存

## 禁止误解

后续 AI 不得把本项目误解为：

- 旧 ePRO 产品
- 患者端 APP
- 完整传统 CTMS
- SubjectVisit 窗口期管理系统
- 单纯的倒计时工具

本项目当前就是：

> CRA 的 AI 临床运营 APP V1，聚焦 MonitoringVisit / IMV 闭环。

