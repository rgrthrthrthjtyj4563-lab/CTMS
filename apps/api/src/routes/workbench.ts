import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';

const contextSchema = z.object({
  projectId: z.string(),
  siteId: z.string().optional(),
});

export async function workbenchRoutes(app: FastifyInstance) {
  app.patch('/context', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const body = contextSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const assignment = await prisma.userAssignment.findFirst({
      where: {
        userId: user.id,
        projectId: body.data.projectId,
        ...(body.data.siteId ? { siteId: body.data.siteId } : {}),
      },
      include: { project: true, site: true },
    });

    if (!assignment) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '无权访问该项目/中心' } });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredProjectId: body.data.projectId,
        preferredSiteId: body.data.siteId ?? assignment.siteId,
      },
      include: { organization: true },
    });

    return {
      context: {
        organizationId: updated.organizationId,
        organizationName: updated.organization.name,
        projectId: assignment.projectId,
        projectCode: assignment.project.code,
        projectName: assignment.project.name,
        siteId: assignment.siteId,
        siteName: assignment.site?.name,
        siteCode: assignment.site?.code,
      },
    };
  });

  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const assignments = await prisma.userAssignment.findMany({
      where: { userId: user.id },
      include: { project: true, site: true },
    });

    const projectIds = [...new Set(assignments.map((a) => a.projectId))];

    const preferredAssignment =
      assignments.find(
        (a) =>
          a.projectId === dbUser?.preferredProjectId &&
          (!dbUser?.preferredSiteId || a.siteId === dbUser.preferredSiteId),
      ) ?? assignments[0];

    const contextProjectId = dbUser?.preferredProjectId ?? preferredAssignment?.projectId;
    const contextSiteId = dbUser?.preferredSiteId ?? preferredAssignment?.siteId;

    const visitScope = {
      craId: user.id,
      ...(contextProjectId ? { projectId: contextProjectId } : {}),
      ...(contextSiteId ? { siteId: contextSiteId } : {}),
    };

    const plannedVisits = await prisma.monitoringVisit.findMany({
      where: {
        ...visitScope,
        plannedDate: { gte: today, lt: tomorrow },
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
      },
      include: { project: true, site: true },
      orderBy: { plannedDate: 'asc' },
    });

    const activeVisit = await prisma.monitoringVisit.findFirst({
      where: {
        ...visitScope,
        status: 'IN_PROGRESS',
      },
      include: { project: true, site: true },
    });

    const pendingPacks = await prisma.actionPack.findMany({
      where: {
        userId: user.id,
        status: { in: ['PENDING_CONFIRM', 'PARTIALLY_CONFIRMED'] },
        ...(contextProjectId
          ? { monitoringVisit: { projectId: contextProjectId } }
          : {}),
      },
      include: {
        monitoringVisit: { include: { project: true, site: true } },
        items: true,
      },
      take: 5,
    });

    const dueIssues = await prisma.issue.findMany({
      where: {
        projectId: contextProjectId ? contextProjectId : { in: projectIds },
        ...(contextSiteId ? { siteId: contextSiteId } : {}),
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        targetDate: { lte: tomorrow },
      },
      include: { project: true, site: true },
      take: 5,
    });

    const pmReturns = await prisma.monitoringVisit.findMany({
      where: {
        ...visitScope,
        status: 'PM_RETURNED',
      },
      include: { project: true, site: true },
      take: 3,
    });

    const unconfirmedHours = await prisma.hoursRecord.count({
      where: {
        userId: user.id,
        status: 'DRAFT_CANDIDATE',
        date: { gte: new Date(today.getTime() - 86400000) },
        ...(contextProjectId ? { projectId: contextProjectId } : {}),
      },
    });

    const highlights = [];

    for (const v of plannedVisits) {
      highlights.push({
        id: v.id,
        type: 'PLANNED_VISIT',
        title: `今日计划 ${v.type} - ${v.site.name}`,
        subtitle: v.project.code,
        priority: 1,
        dueDate: v.plannedDate.toISOString(),
      });
    }

    if (activeVisit) {
      highlights.push({
        id: activeVisit.id,
        type: 'ACTIVE_VISIT',
        title: `进行中 ${activeVisit.type} - ${activeVisit.site.name}`,
        subtitle: activeVisit.project.code,
        priority: 0,
      });
    }

    for (const pack of pendingPacks) {
      const pending = pack.items.filter((i) =>
        ['SUGGESTED', 'PENDING_CONFIRM', 'EDITED'].includes(i.status),
      ).length;
      highlights.push({
        id: pack.id,
        type: 'PENDING_ACTION_PACK',
        title: `待确认动作包 (${pending}项)`,
        subtitle: `${pack.monitoringVisit.site.name}`,
        priority: 2,
      });
    }

    for (const issue of dueIssues) {
      highlights.push({
        id: issue.id,
        type: 'DUE_ISSUE',
        title: issue.title,
        subtitle: issue.site.name,
        priority: 3,
        dueDate: issue.targetDate?.toISOString(),
      });
    }

    for (const ret of pmReturns) {
      highlights.push({
        id: ret.id,
        type: 'PM_RETURN',
        title: `PM退回 - ${ret.site.name}`,
        subtitle: ret.project.code,
        priority: 1,
      });
    }

    if (unconfirmedHours > 0) {
      highlights.push({
        id: 'unconfirmed-hours',
        type: 'UNCONFIRMED_HOURS',
        title: `${unconfirmedHours} 条工时尚未确认`,
        priority: 4,
      });
    }

    highlights.sort((a, b) => a.priority - b.priority);

    const context = {
      organizationId: user.organizationId,
      organizationName: dbUser?.organization.name,
      projectId: activeVisit?.projectId ?? contextProjectId,
      projectCode: activeVisit?.project.code ?? preferredAssignment?.project.code,
      projectName: activeVisit?.project.name ?? preferredAssignment?.project.name,
      siteId: activeVisit?.siteId ?? contextSiteId,
      siteName: activeVisit?.site.name ?? preferredAssignment?.site?.name,
      siteCode: activeVisit?.site.code ?? preferredAssignment?.site?.code,
      activeMonitoringVisitId: activeVisit?.id,
    };

    const timelineVisitId = activeVisit?.id ?? plannedVisits[0]?.id;
    const recentInputs = timelineVisitId
      ? await prisma.visitInput.findMany({
          where: {
            monitoringVisitId: timelineVisitId,
            isVoided: false, // hide voided records from workbench timeline
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    let noVisitReason: string | null = null;
    if (!activeVisit && plannedVisits.length === 0) {
      const anyToday = await prisma.monitoringVisit.count({
        where: {
          craId: user.id,
          plannedDate: { gte: today, lt: tomorrow },
          type: 'IMV',
        },
      });
      if (anyToday > 0) {
        noVisitReason = '当前项目/中心下今日无可用 IMV，请切换上下文或联系 PM';
      } else {
        noVisitReason = '今日暂无计划 IMV，请联系 PM 安排访视';
      }
    }

    const openIssueCount = await prisma.issue.count({
      where: {
        projectId: context.projectId ?? { in: projectIds },
        ...(context.siteId ? { siteId: context.siteId } : {}),
        status: { in: ['OPEN', 'IN_PROGRESS', 'CRA_CONFIRMED'] },
      },
    });

    const aiSuggestion =
      openIssueCount > 0 || dueIssues.length > 0
        ? {
            content: `建议优先跟进 ${openIssueCount} 条未关闭 Issue，并核查受试者原始记录与药物管理文件。`,
            source: '开放 Issue · 访视计划',
          }
        : plannedVisits.length > 0
          ? {
              content:
                '今日计划 IMV 已开始准备。建议核对知情同意、原始记录签字及药物管理温度记录。',
              source: '访视计划 · 标准核查清单',
            }
          : null;

    return {
      context,
      highlights: highlights.slice(0, 5),
      assignments: assignments.map((a) => ({
        projectId: a.projectId,
        projectCode: a.project.code,
        projectName: a.project.name,
        siteId: a.siteId,
        siteName: a.site?.name,
        siteCode: a.site?.code,
      })),
      activeVisit: activeVisit
        ? {
            id: activeVisit.id,
            type: activeVisit.type,
            status: activeVisit.status,
            project: activeVisit.project,
            site: activeVisit.site,
            actualStartTime: activeVisit.actualStartTime?.toISOString(),
          }
        : null,
      plannedVisits: plannedVisits.map((v) => ({
        id: v.id,
        type: v.type,
        status: v.status,
        plannedDate: v.plannedDate.toISOString(),
        project: { id: v.project.id, code: v.project.code, name: v.project.name },
        site: { id: v.site.id, name: v.site.name, code: v.site.code },
      })),
      timeline: recentInputs.map((i) => ({
        id: i.id,
        type: i.type,
        content: i.content.slice(0, 200),
        createdAt: i.createdAt.toISOString(),
      })),
      noVisitReason,
      aiSuggestion,
    };
  });
}