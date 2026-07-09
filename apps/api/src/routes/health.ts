import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/healthz", async () => ({ status: "ok", ts: new Date().toISOString() }));
  app.get("/readyz", async () => ({ status: "ready", ts: new Date().toISOString() }));
}