# Phase 0 审核整改方案

> 本文档供 AI agent 直接执行。每个问题独立，按编号顺序修，修一个验一个，不扩散。

## 背景

AIC-DCT（AI 辅助数字化临床试验操作系统）Phase 0 的目标是搭建工程底座：仓库结构、领域契约（enums/zod schemas）、RBAC 矩阵、审计分类法、AI 输出生命周期、Prisma schema v0、seed 数据、API skeleton。

送审报告声称 Phase 0 已完成并通过全部验收命令。经逐文件源码审查，发现 **4 个 P1 问题必须修复后才能通过 Architect Review Gate**，另有 3 个 P2 问题记入 Phase 1 backlog。

整改原则：**修这一个点，不扩散**。不重构、不优化、不加新功能。

---

## P1-1 `Permission.ProtocolParse` 孤儿权限

### 问题描述

`packages/domain/src/rbac.ts:27` 定义了权限 `ProtocolParse: "protocol:parse"`，但全文搜索该权限只出现 1 次（定义处本身）。`ROLE_PERMISSIONS` 矩阵中没有任何角色持有此权限。

### 原因

遗漏。`AIProtocolParseResult` 模型是协议解析的核心 AI 入口，`openapi.yaml` 也定义了 `/api/projects/{projectId}/protocol/parse` 端点，但 RBAC 层无人能通过 `authorize()` 校验。

### 后果

Phase 2 接真实 handler 后，任何角色调用协议解析都会被 RBAC 拦截 throw `FORBIDDEN`。

### 整改内容

文件：`packages/domain/src/rbac.ts`

在以下三个角色的权限数组中加入 `Permission.ProtocolParse`：

1. `Role.SponsorAdmin`（数组开头，`ProjectRead` 之后）
2. `Role.CROPM`（数组开头，`ProjectRead` 之后）
3. `Role.SystemAdmin`（自动持有全部，无需改）

不需要加给 SitePI/CRC/CRA——协议解析是申办方/CRO 的职责，站点人员不解析方案。

### 验证

```bash
cd packages/domain && npx vitest run rbac.test.ts
```

应在现有 15 个测试基础上补充 1 个断言：
```ts
expect(roleHasPermission(Role.SponsorAdmin, Permission.ProtocolParse)).toBe(true);
expect(roleHasPermission(Role.CROPM, Permission.ProtocolParse)).toBe(true);
expect(roleHasPermission(Role.SitePI, Permission.ProtocolParse)).toBe(false);
```

---

## P1-2 `applyAIConfirmation()` 的 `NeedsInvestigatorConfirmation` 状态不可达

### 问题描述

`packages/domain/src/ai.ts:74-88` 的 `AI_OUTPUT_TRANSITIONS` 把 `Pending -> NeedsInvestigatorConfirmation` 列为合法转换。但 `ai.ts:134-141` 在转换合法性检查通过**之后**，对 `next === NeedsInvestigatorConfirmation` 直接 throw `AI_CONFIRMATION_REQUIRED`，不返回更新对象。

### 原因

逻辑矛盾：状态机说"能转"，函数体说"转了就抛异常"。`NeedsInvestigatorConfirmation` 在 enum、schema、状态机中都存在，但运行时没有任何代码路径能写入这个状态值。

### 后果

- 该状态是死代码
- Phase 1 如果 UI 需要"标记为待研究者确认"功能，会发现后端无法写入
- 现有测试只断言"Pending 不可被 promote"（通过），但漏测了"Pending -> NeedsInvestigatorConfirmation 应成功"

### 整改内容

文件：`packages/domain/src/ai.ts`

删除 `ai.ts:134-141` 的 `if (next === HumanConfirmationStatus.NeedsInvestigatorConfirmation)` 整段 throw 逻辑。让该转换像其他合法转换一样正常返回更新后的 `AIOutput` 对象。

调用方（Phase 2 的 API handler）负责决定是否需要额外的 investigator 校验——这不是 domain 层的职责。

修改前：
```ts
  if (next === HumanConfirmationStatus.NeedsInvestigatorConfirmation) {
    // Investigators (PI/CRC) must complete confirmation; site staff cannot.
    throw new ApiErrorException(
      ApiErrorCode.AI_CONFIRMATION_REQUIRED,
      "AI output marked as needing investigator confirmation; an investigator must adopt or reject it.",
      { details: { status: next } },
    );
  }
```

修改后：直接删除这 8 行。`return { ...output, status: next, ... }` 自然处理该路径。

### 验证

```bash
cd packages/domain && npx vitest run ai.test.ts
```

补充 1 个测试用例：
```ts
it("allows Pending -> NeedsInvestigatorConfirmation", () => {
  const pending = { ...baseOutput, status: HumanConfirmationStatus.Pending };
  const result = applyAIConfirmation(pending, HumanConfirmationStatus.NeedsInvestigatorConfirmation, { userId: "u1" });
  expect(result.status).toBe(HumanConfirmationStatus.NeedsInvestigatorConfirmation);
});
```

---

## P1-3 `packages/config` 缺失

### 问题描述

`docs/development-plans/phase-0-foundation.md` 第 17 行和第 63 行明确要求创建 `packages/config/`（共享 lint、TypeScript、formatting 配置）。实际不存在。当前各 workspace 的 `lint` script 是 `echo "(xxx) no lint configured" && exit 0`。

### 原因

送审报告第七节自行将此项推迟到 Phase 1，但 Architect Review Gate（`phase-0-foundation.md:136-143`）的退出条件是"local app can be installed and checked"。`npm run lint` placeholder exit 0 不构成"succeeds"。

### 后果

- 无 lint 检查，后续 Phase 1 代码质量无保障
- `tsconfig.base.json` 已存在但无共享 ESLint config

### 整改内容

创建 `packages/config/` 目录，包含最小可用配置：

#### 文件 1：`packages/config/package.json`
```json
{
  "name": "@aic-dct/config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./eslint": "./eslint.config.js",
    "./tsconfig": "./tsconfig.json"
  },
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

#### 文件 2：`packages/config/eslint.config.js`
```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
```

#### 文件 3：`packages/config/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

#### 修改各 workspace 的 lint script

- `apps/api/package.json`：`"lint": "eslint src --ext .ts"`
- `apps/web/package.json`：`"lint": "eslint src --ext .ts,.tsx"`
- `apps/worker/package.json`：`"lint": "eslint src --ext .ts"`
- `packages/domain/package.json`：`"lint": "eslint src --ext .ts"`

根 `package.json` 的 `lint` script 改为：
```json
"lint": "npm run lint --workspaces --if-present"
```

### 验证

```bash
npm install
npm run lint    # 应 exit 0，有真实 ESLint 输出（非 placeholder）
npm run typecheck
npm run test
```

---

## P1-4 缺 `.env.example` + `db:migrate`/`db:seed` 未验证

### 问题描述

1. `apps/api/` 目录下无 `.env` 也无 `.env.example`，`npx prisma validate` 裸跑因缺 `DATABASE_URL` 返回 P1012 错误
2. 送审报告声称 `npx prisma validate ✅`，但实际需要手动设置 `DATABASE_URL=stub` 才通过
3. `db:migrate` 和 `db:seed` 从未执行过

### 原因

`schema.prisma:16` 使用 `url = env("DATABASE_URL")`，但未提供环境变量模板。计划 `phase-0-foundation.md:105-106` 要求 migration 能 apply 到干净数据库、seed 能创建完整 demo study。

### 后果

- 新开发者 clone 后无法跑 `npx prisma validate`
- Architect Review Gate 的"local app can be installed and checked"未满足
- schema 可能在 migrate 时才发现问题（如字段顺序、索引缺失）

### 整改内容

#### 文件 1：`apps/api/.env.example`
```
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/aic_dct?schema=public"

# Server
PORT=4000
LOG_LEVEL=info

# Auth (Phase 2+)
JWT_SECRET=changeme
```

#### 文件 2：修改 `apps/api/.gitignore`（如果不存在则在根 `.gitignore` 中追加）
```
.env
```

确保 `.env.example` **不被** gitignore（只有 `.env` 被忽略）。

#### 本地验证步骤（需有 PostgreSQL）

```bash
# 1. 复制环境变量
cp apps/api/.env.example apps/api/.env
# 编辑 .env 填入真实连接串

# 2. 生成 Prisma Client
npm run db:generate

# 3. 运行 migration
npm run db:migrate

# 4. 运行 seed
npm run db:seed

# 5. 验证 seed 输出
# 应看到: Seed complete. + project/sites/users/subjects/ae/sae 摘要
```

### 验证

```bash
npx prisma validate   # 不再需要手动设置 DATABASE_URL
npm run db:migrate    # exit 0
npm run db:seed       # exit 0，输出 Seed complete
```

如果本地无 PostgreSQL，用 Docker：
```bash
docker run -d --name aic-dct-pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=aic_dct -p 5432:5432 postgres:16
```

---

## P2-1 项目无 git 仓库（记入 Phase 1，不阻塞当前 gate）

### 问题描述

`git rev-parse --is-inside-work-tree` 在项目根目录返回 `fatal: not a git repository`。

### 后果

- 无法用 git 验证变更历史
- 送审报告关注点 7"git status 确认 Web后台UI设计 仍原样未动"无法执行
- 临床试验合规系统无版本控制是审计红线

### 建议

```bash
cd /Users/lee/Developer/PersonalProjects/个人研发项目/临床试验
git init
git add -A
git commit -m "Phase 0 foundation"
```

---

## P2-2 `formatConfidence()` 硬编码中文标签（记入 Phase 1）

### 问题描述

`packages/domain/src/ai.ts:173-184` 的 `formatConfidence()` 返回硬编码中文字符串。domain 包应语言无关。

### 建议

Phase 1 国际化时，改为返回 `ConfidenceLevel` 枚举，UI 层做 i18n。当前不阻塞。

---

## P2-3 `SubjectSensitiveIdentity` 缺索引（记入 Phase 1）

### 问题描述

`schema.prisma:183-201` 的 `SubjectSensitiveIdentity` 模型只有 `subjectId @id`，无 `@@index([lastViewedAt])` 或 `@@index([lastViewedByUserId])`。

### 建议

Phase 2 接真实查询时补充：
```prisma
@@index([lastViewedAt])
@@index([lastViewedByUserId])
```

---

## 执行顺序

1. P1-1（rbac.ts 加权限）→ 跑测试
2. P1-2（ai.ts 删死代码）→ 跑测试
3. P1-3（创建 packages/config）→ npm install + lint + typecheck + test
4. P1-4（创建 .env.example + 跑 migrate/seed）→ 验证 seed 输出
5. 全量验收：`npm run typecheck && npm run lint && npm run test`
6. P2-1 git init + 首次 commit

## 不做什么

- 不重构现有代码
- 不优化 schema 结构
- 不加新功能
- 不动 `Web后台UI设计/`
- 不引入 Next.js / Redis / OIDC
- P2-2 和 P2-3 留到 Phase 1
