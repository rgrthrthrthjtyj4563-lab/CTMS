// AgentCTMS MVP 投资人演示专用 seed：
//   1. 复用主 seed 已建的项目/中心/账号（含 demo ZZ-101 / 上海六院）；
//   2. 把 CRA/PM/QA 的 preferredProject/Site 切到 ZZ-101；
//   3. 兜底确保今日 IMV 在演示项目下存在；
//   4. 不删除任何历史数据，避免破坏 e2e 工程回归。
//
// 运行：pnpm --filter @clinical/api db:seed:demo
// 回滚主账号默认上下文：pnpm --filter @clinical/api db:reset
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const demoProject = await prisma.project.findUnique({
    where: { id: 'seed-demo-project-zz101' },
    include: { sites: true },
  });
  if (!demoProject) {
    throw new Error(
      '演示项目 seed-demo-project-zz101 不存在，请先执行 pnpm --filter @clinical/api db:seed',
    );
  }
  const demoSite = demoProject.sites.find((s) => s.id === 'seed-demo-site-sh6');
  if (!demoSite) {
    throw new Error('演示中心 seed-demo-site-sh6 不存在，请先执行主 seed');
  }

  const phones = ['13800138001', '13800138002', '13800138003'];
  const updated = await prisma.user.updateMany({
    where: { phone: { in: phones } },
    data: {
      preferredProjectId: demoProject.id,
      preferredSiteId: demoSite.id,
    },
  });

  // 兜底：演示 IMV 已在主 seed 写入；这里只校验存在
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const cra = await prisma.user.findUnique({ where: { phone: '13800138001' } });
  if (!cra) throw new Error('CRA 账号不存在');

  const visitCount = await prisma.monitoringVisit.count({
    where: {
      projectId: demoProject.id,
      siteId: demoSite.id,
      craId: cra.id,
      plannedDate: { gte: today, lt: tomorrow },
      type: 'IMV',
      status: { in: ['PLANNED', 'IN_PROGRESS'] },
    },
  });
  if (visitCount === 0) {
    await prisma.monitoringVisit.create({
      data: {
        projectId: demoProject.id,
        siteId: demoSite.id,
        craId: cra.id,
        type: 'IMV',
        status: 'PLANNED',
        plannedDate: today,
      },
    });
  }

  console.log(`Demo context applied for ${updated.count} user(s):`);
  console.log(`  Project: ${demoProject.code} - ${demoProject.name}`);
  console.log(`  Site:    ${demoSite.name}`);
  console.log('  CRA 13800138001 / PM 13800138002 / QA 13800138003  - password');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// bcrypt 仅当主 seed 未跑过且需要就地建账号时引入；这里保持空引用避免误删
void bcrypt;
