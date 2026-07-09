import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerConsentRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/consent", [
    { method: "GET", url: "/documents", phase: "Phase 2" },
    { method: "POST", url: "/documents", phase: "Phase 2" },
    { method: "GET", url: "/tasks", phase: "Phase 2" },
    { method: "POST", url: "/tasks/:taskId/start", phase: "Phase 2" },
    { method: "POST", url: "/tasks/:taskId/sign", phase: "Phase 2" },
    { method: "POST", url: "/tasks/:taskId/re-consent", phase: "Phase 2" },
    { method: "POST", url: "/tasks/:taskId/withdraw", phase: "Phase 2" },
  ]);
}