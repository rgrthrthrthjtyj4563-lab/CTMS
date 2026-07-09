/**
 * Skeleton helper for Phase 0 routes.
 *
 * Each domain module returns a typed 501 with the canonical ApiError envelope.
 * This lets the API contract be reviewed end-to-end (route map, request/response
 * shape, error envelope) before any database wiring lands.
 */
import type { FastifyInstance, RouteOptions } from "fastify";
import { ApiErrorCode, ApiErrorException } from "@aic-dct/domain";

export function skeletonError(requestId: string, phase: string): ApiErrorException {
  return new ApiErrorException(
    ApiErrorCode.INTERNAL,
    `This endpoint is reserved by the Phase 0 contract; implementation lands in ${phase}.`,
    { requestId, details: { phase } },
  );
}

type SkeletonRoute = {
  method: RouteOptions["method"];
  url: string;
  schema?: RouteOptions["schema"];
  phase?: string;
};

export function registerSkeletonRoutes(
  app: FastifyInstance,
  basePath: string,
  routes: ReadonlyArray<SkeletonRoute>,
): void {
  for (const r of routes) {
    const phase = r.phase ?? "a later phase";
    app.route({
      method: r.method,
      url: `${basePath}${r.url}`,
      schema: r.schema,
      handler: async (req) => {
        throw skeletonError(req.id, phase);
      },
    });
  }
}