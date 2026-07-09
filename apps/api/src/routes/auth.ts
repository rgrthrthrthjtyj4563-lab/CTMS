/**
 * Skeleton: auth/login endpoints. Real OIDC implementation lands in Phase 2.
 * Phase 0 returns a typed 501 with the canonical error envelope so the API
 * shape is reviewable.
 */
import type { FastifyInstance } from "fastify";
import { ApiErrorCode, ApiErrorException } from "@aic-dct/domain";

function notImplemented(requestId: string): ApiErrorException {
  return new ApiErrorException(
    ApiErrorCode.INTERNAL,
    "Auth handlers are part of Phase 2; the route is registered for contract review only.",
    { requestId, details: { phase: "Phase 2" } },
  );
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/api/auth/login", async (req) => {
    throw notImplemented(req.id);
  });
  app.post("/api/auth/logout", async (req) => {
    throw notImplemented(req.id);
  });
  app.get("/api/auth/session", async (req) => {
    throw notImplemented(req.id);
  });
}