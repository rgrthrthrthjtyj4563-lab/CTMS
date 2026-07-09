import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerAiConfigRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/ai", [
    { method: "GET", url: "/configs", phase: "Phase 3" },
    { method: "PUT", url: "/configs/:configId", phase: "Phase 3" },
    { method: "GET", url: "/prompt-templates", phase: "Phase 3" },
    { method: "POST", url: "/prompt-templates", phase: "Phase 3" },
    { method: "GET", url: "/outputs", phase: "Phase 3" },
    { method: "POST", url: "/outputs/:outputId/adopt", phase: "Phase 3" },
    { method: "POST", url: "/outputs/:outputId/reject", phase: "Phase 3" },
    { method: "GET", url: "/call-logs", phase: "Phase 3" },
  ]);
}