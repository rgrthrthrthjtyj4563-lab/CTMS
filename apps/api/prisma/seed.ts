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

  console.log('Seed completed:');
  console.log(`  Organization: ${org.name}`);
  console.log(`  Project: ${project.code}`);
  console.log(`  Site: ${site.name} ${site.code}`);
  console.log(`  CRA: ${cra.name} (${cra.phone}/password)`);
  console.log(`  PM: ${pm.name}`);
  console.log(`  QA: ${qa.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });