# Phase 0 审核整改执行指令

## 你是谁

你是一个 TypeScript 全栈工程师 agent，负责执行 AIC-DCT（AI 辅助数字化临床试验操作系统）项目的 Phase 0 审核整改。

## 项目位置

`/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验`

这是一个 npm workspaces monorepo：`apps/api`（Fastify+Prisma）、`apps/web`（占位）、`apps/worker`（占位）、`packages/domain`（共享领域包）。

## 背景

Phase 0 的目标是搭建工程底座（领域契约、RBAC、审计、AI 输出生命周期、Prisma schema、API skeleton）。代码已由前一个 agent 写完，但经架构师审查发现 4 个 P1 问题必须修复后才能通过 Architect Review Gate。整改方案已写入 `docs/development-plans/phase-0-review-fixes.md`——**先读这个文件**，它是你的整改依据。

## 执行原则

1. **修一个点，不扩散**。不重构、不优化、不加新功能、不动 `Web后台UI设计/`。
2. **每修完一个 P1 立即跑验证命令**，通过后再修下一个。
3. **遇到计划之外的 schema 问题**，记录下来 appended 到整改方案末尾，不擅自修。
4. **不改 Phase 0 已通过的代码**。只改整改方案明确指出的文件和行。
5. **中文路径用 shell_quote**。终端命令中含中文路径时用 `cd "/path/含中文"` 包裹。

## 执行顺序

按以下顺序逐条执行，每条执行完后跑对应的验证命令：

### P1-1：`rbac.ts` 补 `ProtocolParse` 权限

文件：`packages/domain/src/rbac.ts`

在 `ROLE_PERMISSIONS` 中给 `SponsorAdmin` 和 `CROPM` 两个角色的权限数组加入 `Permission.ProtocolParse`。加在 `ProjectRead` 之后即可。`SystemAdmin` 持有全集无需改。`SitePI/CRC/CRA` 不加——协议解析是申办方/CRO 职责。

验证：
```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/packages/domain"
npx vitest run rbac.test.ts
```
补充 1 个测试用例断言 SponsorAdmin/CROPM 持有该权限、SitePI 不持有。

### P1-2：`ai.ts` 删 `NeedsInvestigatorConfirmation` 死代码

文件：`packages/domain/src/ai.ts`

删除 `applyAIConfirmation()` 函数中 `if (next === HumanConfirmationStatus.NeedsInvestigatorConfirmation)` 整段 throw 逻辑（约 8 行）。让该转换像其他合法转换一样正常返回更新后的 output 对象。原因：状态机声明该转换合法，但函数体拦截它 throw，导致该状态值运行时不可达。

验证：
```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/packages/domain"
npx vitest run ai.test.ts
```
补充 1 个测试：`Pending -> NeedsInvestigatorConfirmation` 应成功返回更新后的 output。

### P1-3：创建 `packages/config` + 真实化 lint

当前 `packages/config/` 不存在，各 workspace 的 `lint` script 是 `echo "no lint configured" && exit 0`。计划 `docs/development-plans/phase-0-foundation.md` 要求创建此包。

创建：
- `packages/config/package.json`（name: `@aic-dct/config`，exports 指向 eslint.config.js 和 tsconfig.json）
- `packages/config/eslint.config.js`（用 typescript-eslint recommended，最小配置）
- `packages/config/tsconfig.json`（extends 根 tsconfig.base.json）

修改各 workspace 的 `lint` script：
- `apps/api`：`eslint src --ext .ts`
- `apps/web`：`eslint src --ext .ts,.tsx`
- `apps/worker`：`eslint src --ext .ts`
- `packages/domain`：`eslint src --ext .ts`

验证：
```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
npm install
npm run lint       # 应有真实 ESLint 输出，exit 0
npm run typecheck  # exit 0
npm run test       # 全部通过
```

### P1-4：创建 `.env.example` + 验证 migrate/seed

当前 `apps/api/` 无 `.env` 也无 `.env.example`，`npx prisma validate` 裸跑因缺 `DATABASE_URL` 报 P1012。

创建 `apps/api/.env.example`，内容包含 `DATABASE_URL`、`PORT`、`LOG_LEVEL`、`JWT_SECRET`（标注 Phase 2+）。

确保 `.gitignore` 忽略 `.env` 但不忽略 `.env.example`。

然后本地跑通 migrate + seed。如果本地无 PostgreSQL，用 Docker 启一个：
```bash
docker run -d --name aic-dct-pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=aic_dct -p 5432:5432 postgres:16
```

验证：
```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验/apps/api"
cp .env.example .env  # 编辑填入真实连接串
npx prisma validate   # 不再需要手动设 DATABASE_URL
npm run db:generate
npm run db:migrate     # exit 0
npm run db:seed        # exit 0，输出 "Seed complete."
```

### P2-1：git init

```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
git init
git add -A
git commit -m "Phase 0 foundation (post-review fixes)"
```

## 最终全量验收

全部 P1 修完后，一次性跑：
```bash
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
npm run typecheck && npm run lint && npm run test
```
三条全 exit 0 才算通过。

## 完成后输出

执行完毕后，输出一份结构化报告：
1. 每个 P1 的修改文件列表 + 验证结果（pass/fail）
2. 测试数量变化（修前 68 → 修后 N）
3. migrate/seed 是否跑通
4. 遇到的计划外问题（如有）
5. 是否建议进入 Phase 1

## 不做什么

- 不重构 `packages/domain/src/` 下已通过的模块
- 不优化 Prisma schema 结构（除非 migrate 报错）
- 不动 `Web后台UI设计/` 目录
- 不引入 Next.js / Redis / OIDC / 对象存储
- P2-2（formatConfidence 国际化）和 P2-3（SubjectSensitiveIdentity 索引）留到 Phase 1，不做
