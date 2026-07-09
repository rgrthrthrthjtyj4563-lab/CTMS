import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerReportRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/reports", [
    { method: "GET", url: "", phase: "Phase 3" },
    { method: "POST", url: "", phase: "Phase 3" },
    { method: "POST", url: "/:reportId/confirm", phase: "Phase 3" },
    { method: "POST", url: "/:reportId/export", phase: "Phase 3" },
  ]);
}