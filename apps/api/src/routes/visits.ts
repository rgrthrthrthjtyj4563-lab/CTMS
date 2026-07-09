import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerVisitRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/visits", [
    { method: "GET", url: "", phase: "Phase 2" },
    { method: "POST", url: "", phase: "Phase 2" },
    { method: "GET", url: "/:visitId", phase: "Phase 2" },
    { method: "PATCH", url: "/:visitId", phase: "Phase 2" },
    { method: "POST", url: "/:visitId/start", phase: "Phase 2" },
    { method: "POST", url: "/:visitId/submit", phase: "Phase 2" },
    { method: "POST", url: "/:visitId/close", phase: "Phase 2" },
    { method: "POST", url: "/:visitId/remote-session", phase: "Phase 2" },
  ]);
}