/**
 * Project routes. Phase 1 wires:
 *   - GET /api/projects          → list projects the calling user can see
 *   - GET /api/projects/:id      → project detail
 *
 * The other Phase 2/3 surfaces stay as skeletons.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiErrorCode, ApiErrorException } from "@aic-dct/domain";
import { prisma } from "../db.js";
import { registerSkeletonRoutes } from "./_skeleton.js";

const idParam = z.object({ projectId: z.string().min(1) });

export function registerProjectRoutes(app: FastifyInstance): void {
  /**
   * List projects. Phase 1 returns every project (no role scoping
   * because the seed only has one project anyway); Phase 2 will scope
   * by the actor's role assignments.
   */
  app.get("/api/projects", async () => {
    const projects = await prisma().project.findMany({
      include: {
        _count: { select: { sites: true, subjects: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      projects: projects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        role: "SponsorAdmin" as const,
        sites: p._count.sites,
        subjects: p._count.subjects,
      })),
    };
  });

  app.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId",
    async (req) => {
      const parsed = idParam.safeParse(req.params);
      if (!parsed.success) {
        throw new ApiErrorException(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid projectId",
          { requestId: req.id },
        );
      }
      const project = await prisma().project.findUnique({
        where: { id: parsed.data.projectId },
        include: { sites: true, _count: { select: { subjects: true } } },
      });
      if (!project) {
        throw new ApiErrorException(
          ApiErrorCode.NOT_FOUND,
          "Project not found",
          { requestId: req.id },
        );
      }
      return { project };
    },
  );

  // Remaining surfaces are still Phase 2+ skeletons.
  registerSkeletonRoutes(app, "/api/projects", [
    { method: "POST", url: "", phase: "Phase 2" },
    { method: "PATCH", url: "/:projectId", phase: "Phase 2" },
    { method: "POST", url: "/:projectId/archive", phase: "Phase 2" },
    { method: "GET", url: "/:projectId/dashboard", phase: "Phase 2" },
    { method: "POST", url: "/:projectId/protocol/parse", phase: "Phase 3" },
    { method: "POST", url: "/:projectId/protocol/:versionId/activate", phase: "Phase 3" },
  ]);
}
