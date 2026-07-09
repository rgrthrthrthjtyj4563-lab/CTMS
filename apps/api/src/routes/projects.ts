import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerProjectRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/projects", [
    { method: "GET", url: "", phase: "Phase 2" },
    { method: "POST", url: "", phase: "Phase 2" },
    { method: "GET", url: "/:projectId", phase: "Phase 2" },
    { method: "PATCH", url: "/:projectId", phase: "Phase 2" },
    { method: "POST", url: "/:projectId/archive", phase: "Phase 2" },
    { method: "GET", url: "/:projectId/dashboard", phase: "Phase 2" },
    { method: "POST", url: "/:projectId/protocol/parse", phase: "Phase 3" },
    { method: "POST", url: "/:projectId/protocol/:versionId/activate", phase: "Phase 3" },
  ]);
}