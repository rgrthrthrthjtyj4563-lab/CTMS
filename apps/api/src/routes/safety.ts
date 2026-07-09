import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerSafetyRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/safety", [
    { method: "GET", url: "/events", phase: "Phase 3" },
    { method: "POST", url: "/events", phase: "Phase 3" },
    { method: "GET", url: "/events/:eventId", phase: "Phase 3" },
    { method: "POST", url: "/events/:eventId/confirm", phase: "Phase 3" },
    { method: "POST", url: "/events/:eventId/report", phase: "Phase 3" },
    { method: "POST", url: "/events/:eventId/follow-up", phase: "Phase 3" },
    { method: "POST", url: "/events/:eventId/close", phase: "Phase 3" },
  ]);
}