import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  // Standard infra probes (Kubernetes / load balancer / uptime monitors).
  app.get("/healthz", async () => ({ status: "ok", ts: new Date().toISOString() }));
  app.get("/readyz", async () => ({ status: "ready", ts: new Date().toISOString() }));

  // Domain-prefixed alias used by the Web dashboard and monitoring tools.
  // Phase 1 contract: returns 200 with the same payload shape as /healthz.
  app.get("/api/health", async () => ({
    status: "ok",
    ts: new Date().toISOString(),
    service: "aic-dct-api",
    phase: "1",
  }));
}