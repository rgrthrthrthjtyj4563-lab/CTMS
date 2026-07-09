import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerDocumentRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/documents", [
    { method: "GET", url: "", phase: "Phase 2" },
    { method: "POST", url: "", phase: "Phase 2" },
    { method: "POST", url: "/:documentId/versions", phase: "Phase 2" },
    { method: "GET", url: "/:documentId/versions", phase: "Phase 2" },
  ]);
}