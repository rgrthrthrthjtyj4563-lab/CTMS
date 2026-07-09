import type { FastifyInstance } from "fastify";
import { registerSkeletonRoutes } from "./_skeleton.js";

export function registerDrugSampleRoutes(app: FastifyInstance): void {
  registerSkeletonRoutes(app, "/api/drugs", [
    { method: "GET", url: "/shipments", phase: "Phase 4" },
    { method: "POST", url: "/shipments", phase: "Phase 4" },
    { method: "POST", url: "/shipments/:shipmentId/receive", phase: "Phase 4" },
  ]);
  registerSkeletonRoutes(app, "/api/samples", [
    { method: "GET", url: "/transfers", phase: "Phase 4" },
    { method: "POST", url: "/transfers", phase: "Phase 4" },
    { method: "POST", url: "/transfers/:transferId/collect", phase: "Phase 4" },
    { method: "POST", url: "/transfers/:transferId/transport", phase: "Phase 4" },
  ]);
}