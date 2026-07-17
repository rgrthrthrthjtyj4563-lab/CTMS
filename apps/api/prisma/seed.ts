import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password', 10);

  const org = await prisma.organization.upsert({
    where: { code: 'QIMING' },
    update: {},
    create: {
      code: 'QIMING',
      name: '启明医药CRO',
    },
  });

  const project = await prisma.project.upsert({
    where: { id: 'seed-project-aj001' },
    update: {},
    create: {
      id: 'seed-project-aj001',
      code: 'AJ-001',
      name: 'AJ-001',
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });

  const site = await prisma.site.upsert({
    where: { id: 'seed-site-huashan' },
    update: {},
    create: {
      id: 'seed-site-huashan',
      projectId: project.id,
      code: '中心05',
      name: '华山医院',
      city: '上海',
    },
  });

  const cra = await prisma.user.upsert({
    where: { phone: '13800138001' },
    update: {},
    create: {
      phone: '13800138001',
      passwordHash,
      name: '李明',
      role: 'CRA',
      organizationId: org.id,
    },
  });

  const pm = await prisma.user.upsert({
    where: { phone: '13800138002' },
    update: {},
    create: {
      phone: '13800138002',
      passwordHash,
      name: '王芳',
      role: 'PM',
      organizationId: org.id,
    },
  });

  const qa = await prisma.user.upsert({
    where: { phone: '13800138003' },
    update: {},
    create: {
      phone: '13800138003',
      passwordHash,
      name: '张磊',
      role: 'QA',
      organizationId: org.id,
    },
  });

  await prisma.userAssignment.upsert({
    where: {
      userId_projectId_siteId: {
        userId: cra.id,
        projectId: project.id,
        siteId: site.id,
      },
    },
    update: {},
    create: {
      userId: cra.id,
      projectId: project.id,
      siteId: site.id,
      role: 'CRA',
    },
  });

  await prisma.userAssignment.upsert({
    where: {
      userId_projectId_siteId: {
        userId: pm.id,
        projectId: project.id,
        siteId: site.id,
      },
    },
    update: {},
    create: {
      userId: pm.id,
      projectId: project.id,
      siteId: site.id,
      role: 'PM',
    },
  });

  await prisma.userAssignment.upsert({
    where: {
      userId_projectId_siteId: {
        userId: qa.id,
        projectId: project.id,
        siteId: site.id,
      },
    },
    update: {},
    create: {
      userId: qa.id,
      projectId: project.id,
      siteId: site.id,
      role: 'QA',
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today.getTime() + 86400000);

  const usableVisit = await prisma.monitoringVisit.findFirst({
    where: {
      projectId: project.id,
      siteId: site.id,
      craId: cra.id,
      plannedDate: { gte: today, lt: tomorrow },
      type: 'IMV',
      status: { in: ['PLANNED', 'IN_PROGRESS'] },
    },
  });

  if (!usableVisit) {
    await prisma.monitoringVisit.create({
      data: {
        projectId: project.id,
        siteId: site.id,
        craId: cra.id,
        type: 'IMV',
        status: 'PLANNED',
        plannedDate: today,
      },
    });
  }

  await prisma.user.update({
    where: { id: cra.id },
    data: {
      preferredProjectId: project.id,
      preferredSiteId: site.id,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // AgentCTMS 投资人演示专用数据（D0/D1 Demo Freeze 冻结）
  //  - 默认 seed 只追加「演示项目/中心/历史 Issue/今日 IMV」
  //  - 不覆写 CRA/PM/QA 的 preferredProject/Site，避免破坏 e2e 与工作台
  //  - 演示专用账号、走 demo seed 脚本另行覆写默认上下文
  // ─────────────────────────────────────────────────────────────
  const demoProject = await prisma.project.upsert({
    where: { id: 'seed-demo-project-zz101' },
    update: { name: 'ZZ-101 III期临床研究' },
    create: {
      id: 'seed-demo-project-zz101',
      code: 'ZZ-101',
      name: 'ZZ-101 III期临床研究',
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });

  const demoSite = await prisma.site.upsert({
    where: { id: 'seed-demo-site-sh6' },
    update: { name: '上海市第六人民医院' },
    create: {
      id: 'seed-demo-site-sh6',
      projectId: demoProject.id,
      code: 'SH6',
      name: '上海市第六人民医院',
      city: '上海',
    },
  });

  for (const u of [cra, pm, qa]) {
    await prisma.userAssignment.upsert({
      where: {
        userId_projectId_siteId: {
          userId: u.id,
          projectId: demoProject.id,
          siteId: demoSite.id,
        },
      },
      update: {},
      create: {
        userId: u.id,
        projectId: demoProject.id,
        siteId: demoSite.id,
        role: u.role,
      },
    });
  }

  // 历史 Issue（演示简报页要展示）
  const demoIssues = [
    {
      title: '药物温度记录缺失',
      description: '7 月 12 日药房温度记录缺失，需补齐并由 PI 复核签字',
      category: 'DRUG_ACCOUNTABILITY',
      severity: 'MEDIUM',
    },
    {
      title: 'ICF 版本更新未完全回收',
      description: '部分受试者尚未签署最新版本知情同意书',
      category: 'DOCUMENTATION',
      severity: 'LOW',
    },
  ];
  for (const it of demoIssues) {
    const existing = await prisma.issue.findFirst({
      where: {
        projectId: demoProject.id,
        siteId: demoSite.id,
        title: it.title,
        reporterId: cra.id,
      },
    });
    if (!existing) {
      await prisma.issue.create({
        data: {
          projectId: demoProject.id,
          siteId: demoSite.id,
          reporterId: cra.id,
          status: 'OPEN',
          ...it,
        },
      });
    }
  }

  // 今日 IMV（演示入口）
  const existingDemoVisit = await prisma.monitoringVisit.findFirst({
    where: {
      projectId: demoProject.id,
      siteId: demoSite.id,
      craId: cra.id,
      plannedDate: { gte: today, lt: tomorrow },
      type: 'IMV',
      status: { in: ['PLANNED', 'IN_PROGRESS'] },
    },
  });
  if (!existingDemoVisit) {
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

  console.log('Seed completed:');
  console.log(`  Organization: ${org.name}`);
  console.log(`  Project: ${project.code}`);
  console.log(`  Site: ${site.name} ${site.code}`);
  console.log(`  CRA: ${cra.name} (${cra.phone}/password)`);
  console.log(`  PM: ${pm.name}`);
  console.log(`  QA: ${qa.name}`);
  console.log('  --- Demo (ZZ-101) ---');
  console.log(`  Project: ${demoProject.code} - ${demoProject.name}`);
  console.log(`  Site: ${demoSite.name}`);
  console.log(`  Demo visit: IMV today @ ${demoSite.name} (CRA=${cra.name})`);
  console.log('  演示账号上下文覆写需要 db:seed:demo，否则演示请先切换项目/中心');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });