import type { FastifyInstance } from 'fastify';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';

export async function todoRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { group, status, scope, projectId, assigneeId } = request.query as {
      group?: string;
      status?: string;
      scope?: string; // self | team
      projectId?: string;
      assigneeId?: string;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const wantTeam = scope === 'team' && ['PM', 'QA', 'ADMIN'].includes(user.role);

    if (wantTeam) {
      const assignments = await prisma.userAssignment.findMany({
        where: {
          userId: user.id,
          role: { in: [user.role, 'PM', 'QA', 'ADMIN'] },
          ...(projectId ? { projectId } : {}),
        },
      });
      const projectIds = [...new Set(assignments.map((a) => a.projectId))];

      if (projectIds.length === 0) {
        return formatTodosResponse([], today, tomorrow, 'team', user.role);
      }

      const teamUsers = await prisma.userAssignment.findMany({
        where: { projectId: { in: projectIds } },
        select: { userId: true },
      });
      const teamUserIds = [...new Set(teamUsers.map((t) => t.userId))];

      // Filter todos belonging to team and within authorized projects
      const todos = await prisma.todo.findMany({
        where: {
          userId: assigneeId ? assigneeId : { in: teamUserIds },
          ...(status ? { status } : { status: { not: 'COMPLETED' } }),
          ...(group ? { group } : {}),
          OR: [
            { projectId: { in: projectIds } },
            {
              monitoringVisit: { projectId: { in: projectIds } },
            },
            {
              issue: { projectId: { in: projectIds } },
            },
          ],
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          issue: { select: { id: true, title: true, projectId: true } },
          monitoringVisit: { select: { id: true, type: true, projectId: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });

      return formatTodosResponse(todos, today, tomorrow, 'team', user.role);
    }

    const todos = await prisma.todo.findMany({
      where: {
        userId: user.id,
        ...(status ? { status } : { status: { not: 'COMPLETED' } }),
        ...(group ? { group } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        issue: { select: { id: true, title: true, projectId: true } },
        monitoringVisit: { select: { id: true, type: true, projectId: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return formatTodosResponse(todos, today, tomorrow, 'self', user.role);
  });

  app.post('/:id/complete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };

    const todo = await prisma.todo.findFirst({
      where: { id, userId: user.id },
    });

    if (todo) {
      const updated = await prisma.todo.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { todo: updated };
    }

    // PM/QA may complete team todos only within assigned projects
    if (!['PM', 'QA', 'ADMIN'].includes(user.role)) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '待办不存在' } });
    }

    const any = await prisma.todo.findUnique({
      where: { id },
      include: {
        monitoringVisit: { select: { projectId: true } },
        issue: { select: { projectId: true } },
      },
    });
    if (!any) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '待办不存在' } });
    }

    const projectId =
      any.projectId || any.monitoringVisit?.projectId || any.issue?.projectId || null;
    if (!projectId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '待办缺少项目上下文' } });
    }

    const assignment = await prisma.userAssignment.findFirst({
      where: { userId: user.id, projectId },
    });
    if (!assignment) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '无该项目权限' } });
    }

    const updated = await prisma.todo.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return { todo: updated };
  });
}

function formatTodosResponse(
  todos: Array<{
    id: string;
    title: string;
    description: string | null;
    group: string;
    status: string;
    dueDate: Date | null;
    sourceType: string | null;
    sourceId: string | null;
    projectId: string | null;
    siteId: string | null;
    monitoringVisitId: string | null;
    issueId: string | null;
    createdAt: Date;
    userId: string;
    user?: { id: string; name: string; role: string };
    issue?: { id: string; title: string; projectId: string } | null;
    monitoringVisit?: { id: string; type: string; projectId: string } | null;
  }>,
  today: Date,
  tomorrow: Date,
  scope: string,
  viewerRole: string,
) {
  const grouped = {
    NOW: [] as typeof todos,
    DUE_TODAY: [] as typeof todos,
    OVERDUE: [] as typeof todos,
    PENDING_MY_CONFIRM: [] as typeof todos,
    PENDING_MY_REVIEW: [] as typeof todos,
    WAITING_OTHERS: [] as typeof todos,
  };

  for (const todo of todos) {
    const g = todo.group as keyof typeof grouped;
    if (grouped[g]) {
      grouped[g].push(todo);
    } else {
      grouped.NOW.push(todo);
    }
  }

  const mapTodo = (t: (typeof todos)[0]) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    group: t.group,
    status: t.status,
    dueDate: t.dueDate?.toISOString(),
    sourceType: t.sourceType,
    sourceId: t.sourceId,
    projectId: t.projectId,
    siteId: t.siteId,
    monitoringVisitId: t.monitoringVisitId,
    issueId: t.issueId,
    assignee: t.user
      ? { id: t.user.id, name: t.user.name, role: t.user.role }
      : { id: t.userId, name: '', role: '' },
    // Navigation target for client — never a dead link when possible
    href: resolveTodoHref(t, viewerRole),
    createdAt: t.createdAt.toISOString(),
  });

  return {
    todos: todos.map(mapTodo),
    grouped: Object.fromEntries(
      Object.entries(grouped).map(([k, v]) => [
        k,
        v.map((t) => ({
          id: t.id,
          title: t.title,
          group: t.group,
          status: t.status,
          dueDate: t.dueDate?.toISOString(),
          href: resolveTodoHref(t, viewerRole),
        })),
      ]),
    ),
    counts: {
      total: todos.length,
      overdue: todos.filter((t) => t.dueDate && t.dueDate < today).length,
      dueToday: todos.filter(
        (t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow,
      ).length,
    },
    scope,
  };
}

function resolveTodoHref(
  t: {
    sourceType: string | null;
    sourceId: string | null;
    issueId: string | null;
    monitoringVisitId: string | null;
  },
  viewerRole: string,
): string | null {
  if (t.issueId) return `/issue/${t.issueId}`;
  if (t.sourceType === 'ISSUE' && t.sourceId) return `/issue/${t.sourceId}`;
  if (t.sourceType === 'ACTION_PACK' && t.sourceId) {
    // PM/QA open review mode; CRA opens confirm/action pack
    if (['PM', 'QA', 'ADMIN'].includes(viewerRole)) {
      return `/action-pack?packId=${t.sourceId}&mode=review`;
    }
    return `/action-pack?packId=${t.sourceId}`;
  }
  // TASK todos are sourced to their action pack (sourceId = packId).
  // Jump to the matching pack so users land on the actionable item context.
  if (t.sourceType === 'TASK' && t.sourceId) {
    return `/action-pack?packId=${t.sourceId}`;
  }
  if (t.monitoringVisitId) return `/imv-active?visitId=${t.monitoringVisitId}`;
  if (t.sourceType === 'MONITORING_VISIT' && t.sourceId) {
    return `/imv-active?visitId=${t.sourceId}`;
  }
  return null;
}
