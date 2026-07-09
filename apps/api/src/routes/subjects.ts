import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerSubjectRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/subjects", [
    { method: "GET", url: "", phase: "Phase 2" },
    { method: "POST", url: "", phase: "Phase 2" },
    { method: "GET", url: "/:subjectId", phase: "Phase 2" },
    { method: "GET", url: "/:subjectId/identity/full", phase: "Phase 2" },
    { method: "PATCH", url: "/:subjectId/status", phase: "Phase 2" },
    { method: "POST", url: "/:subjectId/withdraw", phase: "Phase 2" },
  ]);
}