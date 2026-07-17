# AI 临床运营 APP V1 — 独立测试方案（供人工 / 其他 AI 执行）

> **文档目的**：让**新会话中的测试 AI**或人工测试员在**不依赖历史对话记忆**的前提下，完成可重复、可判定的 V1 验收测试。  
> **文档状态**：Active  
> **版本**：2026-07-16（对应整改后 Web 主路径）  
> **主验收环境**：**Expo Web + 本地 API**（本次审核问题集中在 Web 端媒体、导航与入口）

---

## 0. 给测试执行者的快速指令（先读）

1. 本仓库是 monorepo：**API（Fastify）+ Mobile（Expo/React Native）**。
2. **业务真源是运行中的 App 与 API**，不是设计包静态演示数据。
3. 设计包 `AI临床运营APP设计` 仅作**视觉/交互基线**，其中「页面选择器」、固定演示数据、假「实时转写」**不算正式功能**。
4. 测试结论必须标注：**通过 / 失败 / 阻塞**，并写清**复现步骤 + 环境 + 证据**（截图或接口响应摘要）。
5. 自动化命令可辅助，**不能替代**本节 Web UI 主路径人工（或浏览器自动化）验收。
6. 若今日无可用访视：执行 `pnpm db:seed` 后再测。

---

## 1. 产品一句话与业务主链

### 1.1 产品目标

CRA 完成一次 **IMV（期中监查访视）** 时，通过文字 / 语音 / 照片 / 文件一次录入，形成可确认的：

- 访视记录候选  
- 工时候选  
- Issue / 行动项候选  
- 证据关联  
- 报告草稿候选  

经 CRA 确认后提交，**PM 审核**（可退回 / 升级 QA）。

**业务闭环（必须跑通）：**

```
访视计划 → 开始访视 → 现场活动 + 多模态记录
  → 结束访视 → 总结确认 → AI 行动包
  → 逐项确认 → 提交 PM → PM 审核（通过/退回/升级 QA）
  → 待办跟踪 / 工时查询
```

### 1.2 本阶段明确不做（测到也不要求通过）

- 真流式「实时转写」  
- 秒级跳动考勤计时器  
- 连续定位 / 后台常驻录音  
- 完整 CAPA 批准关闭生命周期  
- SubjectVisit / 完整 EDC  
- 月度工时二次汇总提交（工时随访视确认）

---

## 2. 仓库与关键路径（必读索引）

### 2.1 根目录

| 路径 | 说明 |
|---|---|
| 仓库根 | `/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验` |
| monorepo 脚本 | 根目录 `package.json` |

### 2.2 需求与设计（产品真相优先序）

发生冲突时优先级：

1. **本测试方案的验收条目**（针对当前已交付代码）  
2. `docs/requirements/ai-clinical-operations-app-v1-requirements.md` — V1 范围、角色、合规  
3. `docs/requirements/ai-clinical-operations-app-ui-requirements.md` — UI 交互细则  
4. `AI临床运营APP设计/src/app/App.tsx` — 页面布局与视觉基线  
5. `AI临床运营APP设计/src/styles/theme.css` — 颜色/圆角  
6. 设计中的静态演示数据 — **忽略**

| 文件 | 用途 |
|---|---|
| `docs/requirements/ai-clinical-operations-app-v1-requirements.md` | 业务范围、成功标准、角色权限 |
| `docs/requirements/ai-clinical-operations-app-ui-requirements.md` | UI 流程说明 |
| `docs/requirements/00-china-ctms-market-and-ai-native-product-direction.md` | 市场与产品方向（背景，非用例） |
| `AI临床运营APP设计/README.md` | 设计包说明与 Figma 链接 |
| `AI临床运营APP设计/src/app/App.tsx` | 设计稿页面总览 |
| `AI临床运营APP设计/src/styles/theme.css` | 主色 `#0B7070`、背景 `#F4F5F7` 等 |
| **本文档** `docs/qa/v1-web-regression-test-plan.md` | **执行验收以本文为准** |

Figma（可选对照）：  
`https://www.figma.com/design/iK6jzJqgmFRgIuWkj2FKlg/AI临床运营APP设计`

### 2.3 实现代码（功能从哪里来）

| 路径 | 说明 |
|---|---|
| `apps/api/` | Fastify API、Prisma、业务规则 |
| `apps/api/prisma/schema.prisma` | 数据模型 |
| `apps/api/prisma/seed.ts` | 演示账号与今日 IMV |
| `apps/api/src/routes/` | REST 路由 |
| `apps/mobile/` | Expo App（CRA/PM/QA 前端） |
| `apps/mobile/app/(tabs)/workbench.tsx` | 工作台 |
| `apps/mobile/app/imv-active.tsx` | 访视进行中 |
| `apps/mobile/app/visit-summary.tsx` | 结束访视总结确认 |
| `apps/mobile/app/action-pack.tsx` | 行动包（含 `mode=review` 审核） |
| `apps/mobile/app/confirm.tsx` | 逐项确认 |
| `apps/mobile/app/voice.tsx` | 语音录入 |
| `apps/mobile/app/(tabs)/todo.tsx` | 待办 |
| `apps/mobile/app/(tabs)/hours.tsx` | 工时 |
| `apps/mobile/app/review.tsx` | 移动审核列表页 |
| `apps/mobile/src/lib/api.ts` | 前端 API 客户端 |
| `apps/mobile/src/lib/media.ts` | 拍照/选文件/录音（含 Web） |
| `apps/mobile/src/lib/upload.ts` | Web/Native FormData 文件转换 |
| `apps/mobile/src/lib/navigation.ts` | 统一路由（pathname+params） |
| `apps/mobile/src/components/InputBar.tsx` | 输入栏（单层边框） |
| `apps/mobile/src/components/InputEditModal.tsx` | 记录编辑/作废 |
| `apps/mobile/src/components/PurposePickerModal.tsx` | 照片用途选择 |
| `packages/domain/` | 共享类型与状态枚举 |

### 2.4 历史整改依据（测试时重点回归）

曾判定「部分可用、未达 V1」的问题（整改后必须复测）：

| ID | 问题 | 期望 |
|---|---|---|
| P0-1 | 输入框双层边框 | 仅一层视觉容器 |
| P0-2 | 工作台记录不能编辑/作废 | 可点开，原因必填 |
| P0-3 | Web 拍照不可用 | 能选图/拍照并上传 |
| P0-4 | Web 语音转写失败（假 FormData） | 可转写或手填发送，不丢录音草稿 |
| P0-5 | 结束访视后端成功但不跳转 | 进入总结页 |
| P0-6 | PM 点待办无审核按钮 | 有通过/退回/升级 QA |
| P0-7 | 自动化假通过 | 失败必须非 0 退出 |

---

## 3. 环境与启动

### 3.1 依赖

- Node.js ≥ 20  
- pnpm  
- 浏览器：Chrome 推荐（验收主浏览器）  
- 可选：手机 Expo Go（第二通道，非本方案主验收）

### 3.2 一键准备数据

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
pnpm install          # 首次
pnpm db:generate      # 首次或 schema 变更后
pnpm db:migrate       # 或 apps/api 下 prisma migrate deploy
pnpm db:seed          # 账号 + 今日可用 IMV
```

### 3.3 启动服务（两个终端）

**终端 A — API（默认端口 3001）**

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
pnpm dev
# 健康检查：curl -s http://localhost:3001/api/health
# 期望：{"status":"ok",...}
```

**终端 B — 前端 Web**

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/mobile"
pnpm exec expo start --web --clear
# 常见地址：
#   http://localhost:8081
#   或终端打印的 Web URL（有时 19006）
```

若 8081 已有 Metro：在 Expo 终端按 `w` 打开 Web。

### 3.4 地址汇总

| 服务 | URL |
|---|---|
| API | `http://localhost:3001` |
| API 健康检查 | `http://localhost:3001/api/health` |
| App Web | `http://localhost:8081`（以终端为准） |
| 设计预览（非业务） | `cd AI临床运营APP设计 && pnpm dev` → 通常 `http://localhost:5173` |

### 3.5 测试账号（seed）

| 角色 | 手机号 | 密码 | 姓名（seed） |
|---|---|---|---|
| **CRA** | `13800138001` | `password` | 李明 |
| **PM** | `13800138002` | `password` | 王芳 |
| **QA** | `13800138003` | `password` | 张磊 |

默认项目：`AJ-001`  
默认中心：华山医院 / 中心05  

### 3.6 环境异常处理

| 现象 | 处理 |
|---|---|
| 无今日 IMV / 无法开始 | `pnpm db:seed` |
| 登录后全按钮无反应 | 硬刷新 + 重新登录；API 是否 401 |
| Metro 异常 / 中文路径 | `--clear` 重启；记录报错原文 |
| 端口占用 | `lsof -iTCP:3001 -sTCP:LISTEN` / `8081` |

---

## 4. App 路由与页面地图

| 页面 | 路由 / 入口 | 角色 |
|---|---|---|
| 登录 | `/login` | 全部 |
| 工作台 | `/(tabs)/workbench` | CRA 主入口 |
| 待办 | `/(tabs)/todo` | CRA 个人；PM/QA 可团队 |
| 工时 | `/(tabs)/hours` | CRA |
| 项目选择 | `/project-select` | 全部 |
| IMV 简报 | `/imv-brief` | CRA |
| IMV 进行中 | `/imv-active` | CRA |
| 语音 | `/voice` | CRA |
| **结束总结** | `/visit-summary` | CRA（结束访视后必达） |
| 行动包 | `/action-pack` | CRA 确认；`mode=review` 时 PM/QA 审核 |
| 逐项确认 | `/confirm` | CRA |
| 移动审核列表 | `/review` | PM/QA |
| Issue 详情 | `/issue/[id]` | 有权限角色 |

**正确导航约定（实现侧）：** 使用 `pathname + params`，避免 Web 上 query string 路由失效。

---

## 5. 状态机（判断按钮是否应出现）

### 5.1 访视 `MonitoringVisit.status`

| 状态 | 含义 | CRA 典型可用动作 |
|---|---|---|
| `PLANNED` | 已计划 | 开始 IMV |
| `IN_PROGRESS` | 进行中 | 录入、拍照、录音、结束访视、编辑记录 |
| `PENDING_WRAP_UP` | 已结束待整理 | 查看总结 / 行动包，勿重复生成包 |
| `PENDING_CRA_CONFIRM` | 待 CRA 确认 | 行动包/逐项确认 |
| `PENDING_PM_REVIEW` | 已提交 PM | CRA 只读；PM 审核 |
| `PM_RETURNED` | PM 退回 | CRA 可补充后重提 |
| `PENDING_QA_REVIEW` | 升级 QA | QA 处理 |
| `APPROVED` | 已通过 | 查询为主 |
| `CANCELLED` | 已取消 | 无业务操作 |

### 5.2 行动包 / 审核

- CRA：生成 `PENDING_CONFIRM` 包 → 逐项确认 → `submit` → 访视 `PENDING_PM_REVIEW`  
- PM：待办「审核 IMV 工作包」→ 行动包 **`mode=review`** → 通过 / 退回 / 升级 QA  

### 5.3 工作记录

- 可编辑/作废：访视大致处于 `IN_PROGRESS` / `PENDING_WRAP_UP` / `PLANNED` / `PM_RETURNED`  
- 已 `PENDING_PM_REVIEW` / `APPROVED`：不可静默改，应提示锁定  

---

## 6. 自动化预检（建议先跑）

在仓库根目录：

```bash
# API 单测（必须真实执行，不应整批 skip）
pnpm --filter @clinical/api test

# 类型检查
pnpm --filter @clinical/api typecheck
pnpm --filter @clinical/mobile typecheck

# 业务 smoke（需 API 已启动）
# 失败码：1=断言失败；2=API 不可用
pnpm smoke
```

**判定：**

| 结果 | 判定 |
|---|---|
| API test 全绿且有用例执行数 | 通过 |
| API test 全部 skip 或 migrate 失败却“绿” | **失败（测试门禁）** |
| smoke exit 0 | 预检通过，仍需做 UI 主路径 |
| smoke exit 1 | **失败**，记录报错原文 |
| smoke exit 2 | 环境阻塞：先起 API，不记业务失败 |

---

## 7. 功能测试用例（核心）

> 记录格式建议：`用例ID | 结果 | 实际现象 | 证据`  
> 未特别说明时，浏览器为 **Chrome + Expo Web**。

### TC-ENV 环境

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-ENV-01 | 访问 `/api/health` | `status=ok` | P0 |
| TC-ENV-02 | 打开 App Web | 登录页或工作台可渲染，非白屏 | P0 |
| TC-ENV-03 | `pnpm db:seed` 后 CRA 登录 | 成功，见项目/中心上下文 | P0 |

---

### TC-AUTH 登录与角色

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-AUTH-01 | CRA `13800138001` / `password` 登录 | 进入工作台 | P0 |
| TC-AUTH-02 | PM `13800138002` 登录 | 可进待办/审核相关页 | P0 |
| TC-AUTH-03 | QA `13800138003` 登录 | 可登录 | P0 |
| TC-AUTH-04 | 错误密码 | 有错误提示，不白屏 | P1 |
| TC-AUTH-05 | API 停掉后操作 | 有错误/重试，不无限转圈无文案 | P1 |

---

### TC-WB 工作台

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-WB-01 | 查看底部导航 | 工作台 / 待办 / 我的（或工时入口）可切换 | P0 |
| TC-WB-02 | 有今日访视时快捷键 | 显示「开始/继续 IMV」；可进入简报或现场 | P0 |
| TC-WB-03 | **无访视**时快捷键 | **不**显示可点的「开始 IMV」或明确禁用并说明原因 | P0 |
| TC-WB-04 | 输入框视觉 | **单层边框**，无双框；focus 无浏览器默认双边 | P0 |
| TC-WB-05 | 输入文字并发送 | 今日记录出现新条目 | P0 |
| TC-WB-06 | **点击今日记录** | 弹出编辑框（非死 View） | P0 |
| TC-WB-07 | 编辑：改内容+原因→保存 | 列表更新；无原因不可保存 | P0 |
| TC-WB-08 | 作废：填原因→作废 | 记录从有效列表消失或不可再当有效记录 | P0 |
| TC-WB-09 | 拍照记录 | 可选拍照/相册 → **用途选择** → 上传成功 → 记录出现 | P0 |
| TC-WB-10 | 附件 | 可选文件+用途并上传 | P1 |
| TC-WB-11 | 语音入口 | 进入语音页 | P0 |
| TC-WB-12 | **结束访视** | 后端成功后 **自动进入总结页** `/visit-summary`，不停留工作台无反馈 | P0 |
| TC-WB-13 | 连点结束 2～3 次 | 不崩；同一有效行动包；幂等 | P0 |

**示例录入文案（便于触发规则/AI 解析）：**

```text
今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。CRC小王承诺周五前补齐，PI下周一复核。
```

---

### TC-IMV 现场访视

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-IMV-01 | 开始/继续进入现场页 | 状态「进行中」；有开始时间 | P0 |
| TC-IMV-02 | 时长展示 | **无秒级跳动大秒表**；显示开始时间与总时长（分钟级） | P0 |
| TC-IMV-03 | 访视活动清单 | 约 6 项（非「记录节点」按钮） | P0 |
| TC-IMV-04 | 勾选活动完成 | 状态变为已完成 | P0 |
| TC-IMV-05 | 点记录编辑/作废 | 同工作台规则 | P0 |
| TC-IMV-06 | 无「实时转写」假文案 | 录音页为「录音中 / 结束后转写」类诚实文案 | P0 |
| TC-IMV-07 | 历史「【节点记录」文本 | 若仍存在，标旧版或可作废，不当作新功能 | P1 |

---

### TC-MEDIA 媒体（Web 重点）

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-MEDIA-01 | Web 相册选图 | 系统文件选择器打开，可选中图片 | P0 |
| TC-MEDIA-02 | 用途必选 | 不选用途不能静默上传成功（有用途弹层） | P0 |
| TC-MEDIA-03 | 上传失败重试 | 有失败提示与重试（可断网测） | P1 |
| TC-MEDIA-04 | Web 录音开始/停止 | 进入录音态；停止后进入转写或结果区 | P0 |
| TC-MEDIA-05 | 转写请求 | **不得**再出现「未上传录音文件」（假 FormData） | P0 |
| TC-MEDIA-06 | 转写失败 | 保留可手填内容 / 可重试；不丢草稿 | P0 |
| TC-MEDIA-07 | 确认发送语音文本 | 工作台或现场时间线出现 VOICE 记录 | P0 |

---

### TC-END 结束访视与总结

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-END-01 | 现场或工作台点结束访视 | 进入 **总结确认页** | P0 |
| TC-END-02 | 总结页内容 | 可见：时间、活动进度、问题候选、行动项、工时候选 | P0 |
| TC-END-03 | 调整结束时间 HH:mm 并保存 | 成功提示；时长/工时相关可更新 | P1 |
| TC-END-04 | 进入行动包 | 能打开明细 | P0 |
| TC-END-05 | 进入逐项确认 | 能确认/跳过并提交 | P0 |
| TC-END-06 | 重复 complete | 同一 packId，无 500，「访视未在进行中」不崩 | P0 |

---

### TC-AI 行动包与来源

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-AI-01 | 展开行动项 | 每项可见 **origin**（规则/模型/人工） | P0 |
| TC-AI-02 | 来源依据 | 非统一假文案；有摘录或明确「无原文/规则推断」 | P0 |
| TC-AI-03 | 类型覆盖（用标准文案） | 通常含访视记录、工时、Issue、任务等候选 | P1 |
| TC-AI-04 | CRA 无审核按钮 | 底部为「逐项确认」而非 PM 通过 | P0 |

---

### TC-CRA-SUBMIT CRA 提交

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-SUB-01 | 逐项确认必要项并提交 | 成功；访视进入待 PM 审核 | P0 |
| TC-SUB-02 | 提交后工作台 | 不应再当进行中随意录入（或明确锁定） | P1 |

---

### TC-PM PM 审核闭环

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-PM-01 | PM 登录打开待办 | 可见「审核 IMV 工作包」类待办 | P0 |
| TC-PM-02 | 点击该待办 | 进入行动包 **审核模式**（`mode=review`） | P0 |
| TC-PM-03 | 页面有决策按钮 | **通过 / 退回 / 升级 QA**（至少一个路径可用） | P0 |
| TC-PM-04 | 点「通过」 | 成功反馈；待办消失或状态变 | P0 |
| TC-PM-05 | （可选）点「退回」 | CRA 侧可见退回状态可补充 | P1 |
| TC-PM-06 | 团队待办 | PM 可看团队 scope；不可越权项目（有 assignment 约束） | P1 |
| TC-PM-07 | 不得只进普通行动包且无任何审核入口 | 若进了无按钮页 → **失败** | P0 |

---

### TC-TODO 待办

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-TODO-01 | CRA 待办 | 仅个人相关 | P0 |
| TC-TODO-02 | 点击有 source 的待办 | 跳转问题/访视/行动包，**无静默无反应** | P0 |
| TC-TODO-03 | 无 source 条目 | 提示无法打开，不白点 | P1 |

---

### TC-HOURS 工时

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-H-01 | 打开工时页 | 有月份与汇总 | P0 |
| TC-H-02 | 切换上月/下月 | 数据变化或空态；箭头有可访问名（a11y） | P0 |
| TC-H-03 | 状态筛选 | 可筛待确认/已审批等 | P1 |
| TC-H-04 | 无「提交本月工时」对 CRA 的双轨审批 | 文案表明随访视确认 | P1 |
| TC-H-05 | 与访视确认工时一致（抽样） | 同一次 IMV 确认后工时明细可见对应记录 | P1 |

---

### TC-PERM 权限与审计（抽测）

| ID | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| TC-P-01 | CRA 不能看到他项目团队待办越权 | 仅授权范围 | P1 |
| TC-P-02 | 编辑/作废需原因 | 无原因被拒 | P0 |
| TC-P-03 | 已提交审核后改输入 | API/UI 拒绝或提示走退回 | P1 |

---

## 8. 推荐完整剧本（一条龙，约 15–25 分钟）

### 剧本 A — CRA 主路径（必须）

1. `pnpm db:seed`，启动 API + Expo Web。  
2. CRA 登录。  
3. 工作台确认输入框单层边框。  
4. 开始/继续 IMV → 现场页。  
5. 勾选 2 项访视活动。  
6. 发送标准文字（第 7 节示例）。  
7. 工作台或现场：点记录 → 编辑并保存。  
8. 拍照/相册 + 用途上传。  
9. 语音：录 2–3 秒 → 停止 → 转写或手填 → 发送。  
10. **结束访视** → **必须到总结页**。  
11. 确认时间 → 进行动包 → 看来源 → 逐项确认 → 提交。  
12. 登出。

### 剧本 B — PM 审核（必须）

1. PM 登录。  
2. 待办打开审核项。  
3. 确认有通过/退回/升级 QA。  
4. 执行「通过」或「退回」之一。  
5. 记录结果。

### 剧本 C — 幂等与回归（建议）

1. 对已结束访视再点结束/总结：不报错、不双包。  
2. 工时切月。  
3. 无访视上下文：按钮禁用/原因可见。

---

## 9. API 抽查（UI 失败时定位用）

```bash
# 登录
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138001","password":"password"}' | jq -r .token)

# 工作台
curl -s http://localhost:3001/api/workbench -H "Authorization: Bearer $TOKEN" | jq .

# 结束+行动包（幂等）
# VISIT_ID 从 workbench.plannedVisits[0].id 或 activeVisit.id 取得
curl -s -X POST "http://localhost:3001/api/monitoring-visits/$VISIT_ID/complete" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"actualEndTime\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}" | jq '{status: .visit.status, pack: .actionPack.id, idempotent}'
```

关键接口一览：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/workbench` | 工作台 |
| POST | `/api/monitoring-visits/:id/start` | 开始 |
| POST | `/api/monitoring-visits/:id/inputs` | 录入 |
| PATCH | `/api/monitoring-visits/:id/inputs/:inputId` | 编辑 |
| POST | `/api/monitoring-visits/:id/inputs/:inputId/void` | 作废 |
| POST | `/api/monitoring-visits/:id/complete` | 结束+行动包（幂等） |
| GET | `/api/monitoring-visits/:id/activities` | 访视活动 |
| POST | `/api/attachments/upload` | 附件（multipart） |
| POST | `/api/voice/transcribe` | 转写（multipart 真实文件） |
| GET | `/api/action-packs/:id` | 行动包 |
| POST | `/api/action-packs/:id/submit` | 提交 PM |
| GET | `/api/todos?scope=self\|team` | 待办 |
| POST | `/api/reviews/action-packs/:packId` | PM/QA 决策 |
| GET | `/api/hours?month=YYYY-MM` | 工时 |

---

## 10. 通过 / 失败总判定

### 10.1 V1 发布门槛（全部满足才算通过）

- [ ] TC-ENV-01～03 通过  
- [ ] 剧本 A 全链路通过（含媒体与结束跳转）  
- [ ] 剧本 B PM 审核按钮可用且至少一种决策成功  
- [ ] P0-1～P0-7 回归项全部通过  
- [ ] `pnpm --filter @clinical/api test` 真实执行且通过  
- [ ] `pnpm smoke` exit 0（API 已启动时）  

### 10.2 判定用语

| 用语 | 含义 |
|---|---|
| **通过** | 步骤与期望一致 |
| **失败** | 可复现不符合期望 |
| **阻塞** | 环境/数据导致无法测（需写清前置） |
| **部分通过** | 仅当主路径通但次要 P1 失败时使用，并列表 |

### 10.3 测试报告模板（请原样填写回传）

```markdown
# V1 Web 回归测试报告

- 日期：
- 执行者：（人工 / 哪个 AI）
- 代码分支/commit：
- 环境：API URL / Web URL / 浏览器版本
- 数据准备：是否 seed

## 自动化
- api test：通过/失败（用例数）
- typecheck：
- smoke：exit code 与摘要

## 剧本 A（CRA）
- 结果：通过/失败
- 失败用例 ID：
- 证据：

## 剧本 B（PM）
- 结果：
- 证据：

## P0 回归表
| ID | 结果 | 备注 |
| P0-1 |  |  |
| P0-2 |  |  |
| P0-3 |  |  |
| P0-4 |  |  |
| P0-5 |  |  |
| P0-6 |  |  |
| P0-7 |  |  |

## 总判定
- [ ] 达到 V1 验收
- [ ] 未达到（原因一句话）

## 缺陷列表
1. 标题 / 严重度 / 复现步骤 / 期望 / 实际
```

---

## 11. 给测试 AI 的执行约束

1. **先读本文 + 需求 V1 文档前 2 章**，不要凭设计包演示数据验收业务。  
2. **优先操作 Web UI**；API 仅用于定位与幂等抽查。  
3. 修改代码前，若你的任务是「只测不修」，则只输出报告；若是「测完修」，再改代码并复测失败项。  
4. 不要把 `AI临床运营APP设计` 里的页面切换器、假数据、假实时转写当成产品缺陷。  
5. 测媒体时必须在 **真实浏览器** 授权麦克风/文件；无权限记为阻塞并写清。  
6. 测试结束可在报告注明：是否产生 `[测试]` 标记的访视数据（可选在记录内容加前缀便于清理）。  
7. 路径含中文：shell 命令请用引号包裹绝对路径。

---

## 12. 附录：视觉基线抽查（可选）

| 项 | 期望 |
|---|---|
| 主色 | 青绿约 `#0B7070` |
| 页面底 | 浅灰约 `#F4F5F7` |
| 卡片 | 白底、圆角约 8 |
| 信息密度 | 专业工具感，非娱乐聊天皮肤 |

对照文件：`AI临床运营APP设计/src/styles/theme.css`

---

## 13. 文档维护

| 变更场景 | 更新本文哪一节 |
|---|---|
| 新增页面路由 | §4 |
| 改登录账号 | §3.5 + seed.ts |
| 新 P0 缺陷关闭 | §2.4 + §7 对应用例 |
| 自动化命令变化 | §6 |

**维护责任**：功能改动方同步更新本测试方案，避免测试 AI 用过期路径验收。

---

*本方案路径均相对于仓库：`/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验`。*
