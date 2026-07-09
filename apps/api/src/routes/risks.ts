import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerRiskRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/risks", [
    { method: "GET", url: "", phase: "Phase 3" },
    { method: "POST", url: "", phase: "Phase 3" },
    { method: "POST", url: "/:riskId/assign", phase: "Phase 3" },
    { method: "POST", url: "/:riskId/resolve", phase: "Phase 3" },
    { method: "POST", url: "/:riskId/close", phase: "Phase 3" },
    { method: "POST", url: "/:riskId/reject", phase: "Phase 3" },
    { method: "GET", url: "/dashboard", phase: "Phase 3" },
  ]);
}