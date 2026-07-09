import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerAuditRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/audit", [
    { method: "GET", url: "/events", phase: "Phase 3" },
    { method: "POST", url: "/events", phase: "Phase 3" },
    { method: "POST", url: "/exports", phase: "Phase 3" },
    { method: "GET", url: "/exports", phase: "Phase 3" },
  ]);
}