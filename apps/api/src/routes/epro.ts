import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerEproRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/epro", [
    { method: "GET", url: "/templates", phase: "Phase 2" },
    { method: "POST", url: "/templates", phase: "Phase 2" },
    { method: "GET", url: "/responses", phase: "Phase 2" },
    { method: "POST", url: "/responses/:responseId/submit", phase: "Phase 2" },
    { method: "POST", url: "/responses/:responseId/review", phase: "Phase 2" },
  ]);
}