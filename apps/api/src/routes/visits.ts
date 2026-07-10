/**
 * Visit endpoints for Phase 2.
 *
 *   GET   /api/visits?subjectId=&status=   — list visits
 *   POST  /api/visits                     — schedule a new visit
 *   GET   /api/visits/:visitId            — visit detail + tasks + remote session
 *   PATCH /api/visits/:visitId/status     — transition lifecycle (Scheduled →
 *                                            InProgress → SubmittedForPI → Completed)
 *   POST  /api/visits/:visitId/remote     — start a remote visit (creates
 *                                            RemoteVisitRecord with a video
 *                                            session id)
 *   PATCH /api/visits/:visitId/tasks/:taskId  — mark a VisitTask complete
 *
 * The remote visit flow ties ECG / blood-pressure / SpO2 measurements to
 * the VitalsReading table from the ePRO module, but Phase 2 only persists
 * the session metadata here. The page renders the device card list from
 * the visit's VisitTask descriptions.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ApiErrorCode,
  ApiErrorException,
  Role,
  VisitStatus,
  type VisitStatus as VisitStatusT,
} from "@aic-dct/domain";
import { prisma } from "../db.js";
import {
  assertVisitTransition,
  audit,
  requireUser,
  type AuthenticatedUser,
} from "../lib/auth.js";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  subjectId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  subjectId: z.string().min(1),
  visitCode: z.string().min(1).max(64),
  scheduledAt: z.string().datetime(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  tasks: z
    .array(z.object({ code: z.string().min(1), description: z.string().min(1) }))
    .optional(),
});

const statusPatchSchema = z.object({
  to: z.nativeEnum(VisitStatus),
  reason: z.string().max(500).optional(),
});

const remoteStartSchema = z.object({
  videoProvider: z.string().min(1).max(64),
  videoSessionId: z.string().min(1).max(128),
});

const taskCompleteSchema = z.object({
  completed: z.boolean(),
});

const ROLES_THAT_CAN_SCHEDULE: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.CROPM,
  Role.SponsorAdmin,
  Role.SystemAdmin,
]);

export function registerVisitRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    "/api/visits",
    async (req) => {
      const user = await requireUser(req);
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad query",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const { projectId, subjectId, status, page, pageSize } = parsed.data;
      const where = {
        subject: { projectId: projectId ?? user.projectId },
        ...(subjectId ? { subjectId } : {}),
        ...(status ? { status: status as VisitStatusT } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma().visit.findMany({
          where,
          include: {
            subject: { select: { subjectCode: true, id: true } },
            remoteSession: true,
            tasks: { orderBy: { code: "asc" } },
          },
          orderBy: { scheduledAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma().visit.count({ where }),
      ]);
      return {
        total,
        page,
        pageSize,
        items: rows.map((v) => ({
          id: v.id,
          subjectId: v.subject.id,
          subjectCode: v.subject.subjectCode,
          visitCode: v.visitCode,
          status: v.status,
          scheduledAt: v.scheduledAt.toISOString(),
          windowStart: v.windowStart.toISOString(),
          windowEnd: v.windowEnd.toISOString(),
          isRemote: Boolean(v.remoteSession),
          remote: v.remoteSession
            ? {
                startedAt: v.remoteSession.startedAt.toISOString(),
                endedAt: v.remoteSession.endedAt?.toISOString() ?? null,
                videoProvider: v.remoteSession.videoProvider,
                videoSessionId: v.remoteSession.videoSessionId,
              }
            : null,
          taskCount: v.tasks.length,
          taskDone: v.tasks.filter((t) => t.completed).length,
        })),
      };
    },
  );

  app.post<{ Body: z.infer<typeof createSchema> }>(
    "/api/visits",
    async (req) => {
      const user = await requireUser(req);
      if (!ROLES_THAT_CAN_SCHEDULE.has(user.role)) {
        throw new ApiErrorException(
          ApiErrorCode.FORBIDDEN,
          `Role ${user.role} cannot schedule visits`,
          { requestId: req.id },
        );
      }
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Bad body",
          { requestId: req.id, details: { issues: parsed.error.issues } },
        );
      }
      const subject = await prisma().subject.findUnique({
        where: { id: parsed.data.subjectId },
      });
      if (!subject || subject.projectId !== user.projectId) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Subject not found",
          { requestId: req.id },
        );
      }
      const visit = await prisma().visit.create({
        data: {
          subjectId: parsed.data.subjectId,
          visitCode: parsed.data.visitCode,
          scheduledAt: new Date(parsed.data.scheduledAt),
          windowStart: new Date(parsed.data.windowStart),
          windowEnd: new Date(parsed.data.windowEnd),
          status: VisitStatus.Scheduled,
          createdByUserId: user.userId,
          tasks: parsed.data.tasks
            ? { create: parsed.data.tasks }
            : undefined,
        },
      });
      await audit(req, user, "visit.create", "Visit", visit.id, {
        subjectId: subject.id,
        visitCode: visit.visitCode,
      });
      return { id: visit.id, status: visit.status };
    },
  );

  app.get<{ Params: { visitId: string } }>(
    "/api/visits/:visitId",
    async (req) => {
      const user = await requireUser(req);
      const visit = await loadVisitScoped(user, req.params.visitId);
      return {
        visit: {
          id: visit.id,
          subjectId: visit.subject.id,
          subjectCode: visit.subject.subjectCode,
          visitCode: visit.visitCode,
          status: visit.status,
          scheduledAt: visit.scheduledAt.toISOString(),
          windowStart: visit.windowStart.toISOString(),
          windowEnd: visit.windowEnd.toISOString(),
        },
        tasks: visit.tasks.map((t) => ({
          id: t.id,
          code: t.code,
          description: t.description,
          completed: t.completed,
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
        remote: visit.remoteSession
          ? {
              startedAt: visit.remoteSession.startedAt.toISOString(),
              endedAt: visit.remoteSession.endedAt?.toISOString() ?? null,
              videoProvider: visit.remoteSession.videoProvider,
              videoSessionId: visit.remoteSession.videoSessionId,
              notes: visit.remoteSession.notes,
            }
          : null,
      };
    },
  );

  app.patch<{
    Params: { visitId: string };
    Body: z.infer<typeof statusPatchSchema>;
  }>("/api/visits/:visitId/status", async (req) => {
    const user = await requireUser(req);
    const parsed = statusPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const visit = await loadVisitScoped(user, req.params.visitId);
    assertVisitTransition(visit.status, parsed.data.to);
    const updated = await prisma().visit.update({
      where: { id: visit.id },
      data: {
        status: parsed.data.to,
        ...(parsed.data.to === VisitStatus.InProgress
          ? {}
          : parsed.data.to === VisitStatus.Completed
            ? {}
            : {}),
      },
    });
    await audit(req, user, "visit.status.transition", "Visit", visit.id, {
      from: visit.status,
      to: updated.status,
      reason: parsed.data.reason ?? null,
    });
    return { id: updated.id, status: updated.status };
  });

  app.post<{
    Params: { visitId: string };
    Body: z.infer<typeof remoteStartSchema>;
  }>("/api/visits/:visitId/remote", async (req) => {
    const user = await requireUser(req);
    const parsed = remoteStartSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const visit = await loadVisitScoped(user, req.params.visitId);
    if (visit.remoteSession) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Visit already has an active remote session",
        { details: { visitId: visit.id } },
      );
    }
    const remote = await prisma().remoteVisitRecord.create({
      data: {
        visitId: visit.id,
        startedAt: new Date(),
        videoProvider: parsed.data.videoProvider,
        videoSessionId: parsed.data.videoSessionId,
      },
    });
    await audit(req, user, "visit.remote.start", "Visit", visit.id, {
      provider: parsed.data.videoProvider,
      sessionId: parsed.data.videoSessionId,
    });
    return {
      id: remote.id,
      visitId: remote.visitId,
      startedAt: remote.startedAt.toISOString(),
      videoProvider: remote.videoProvider,
      videoSessionId: remote.videoSessionId,
    };
  });

  app.patch<{
    Params: { visitId: string; taskId: string };
    Body: z.infer<typeof taskCompleteSchema>;
  }>("/api/visits/:visitId/tasks/:taskId", async (req) => {
    const user = await requireUser(req);
    const parsed = taskCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "Bad body",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const visit = await loadVisitScoped(user, req.params.visitId);
    const task = await prisma().visitTask.findUnique({
      where: { id: req.params.taskId },
    });
    if (!task || task.visitId !== visit.id) {
      throw new ApiErrorException(
        ApiErrorCode.NOT_FOUND,
        "Visit task not found",
        { details: { taskId: req.params.taskId } },
      );
    }
    const updated = await prisma().visitTask.update({
      where: { id: task.id },
      data: {
        completed: parsed.data.completed,
        completedAt: parsed.data.completed ? new Date() : null,
      },
    });
    await audit(req, user, "visit.task.toggle", "VisitTask", task.id, {
      visitId: visit.id,
      completed: parsed.data.completed,
    });
    return {
      id: updated.id,
      completed: updated.completed,
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  });
}

async function loadVisitScoped(
  user: AuthenticatedUser,
  visitId: string,
) {
  const visit = await prisma().visit.findUnique({
    where: { id: visitId },
    include: {
      subject: true,
      tasks: { orderBy: { code: "asc" } },
      remoteSession: true,
    },
  });
  if (!visit) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Visit not found",
      { details: { visitId } },
    );
  }
  if (visit.subject.projectId !== user.projectId) {
    throw new ApiErrorException(
      ApiErrorCode.FORBIDDEN,
      "Visit belongs to a different project",
      { details: { visitId } },
    );
  }
  return visit;
}
