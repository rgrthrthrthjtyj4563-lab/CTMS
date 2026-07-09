/**
 * AIC-DCT API server (Phase 0 skeleton).
 *
 * Goals of this Phase 0 entrypoint:
 *   1. Demonstrate a typed, consistent error envelope via Fastify setErrorHandler.
 *   2. Mount route skeletons for every domain surface listed in the architecture
 *      roadmap. Skeletons return a 501 with the canonical error envelope until
 *      later phases wire real handlers — but they exist so the contract is
 *      reviewable now.
 *   3. Wire CORS, helmet, and request-id so production deployments don't need
 *      a separate config pass later.
 *
 * Real Prisma / DB wiring lands in Phase 2; this file intentionally stays
 * free of database imports so it can boot offline for smoke checks.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { ApiErrorException, ApiErrorCode } from "@aic-dct/domain";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerSubjectRoutes } from "./routes/subjects.js";
import { registerConsentRoutes } from "./routes/consent.js";
import { registerVisitRoutes } from "./routes/visits.js";
import { registerEproRoutes } from "./routes/epro.js";
import { registerSafetyRoutes } from "./routes/safety.js";
import { registerRiskRoutes } from "./routes/risks.js";
import { registerDrugSampleRoutes } from "./routes/drugs-samples.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerAiConfigRoutes } from "./routes/ai-config.js";
import { registerAuditRoutes } from "./routes/audit.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l" } },
    },
    genReqId: () => `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;
    req.log.error({ err, requestId }, "request_failed");

    if (err instanceof ApiErrorException) {
      return reply.status(err.status).send(err.toJSON());
    }

    // Fastify validation errors are exposed as FST_ERR_VALIDATION
    const validation = (err as { validation?: unknown; statusCode?: number }).validation;
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    const code =
      validation && statusCode === 400
        ? ApiErrorCode.VALIDATION_ERROR
        : statusCode === 404
          ? ApiErrorCode.NOT_FOUND
          : statusCode === 401
            ? ApiErrorCode.UNAUTHORIZED
            : statusCode === 403
              ? ApiErrorCode.FORBIDDEN
              : ApiErrorCode.INTERNAL;

    return reply.status(statusCode).send({
      code,
      message: err.message || "Internal error",
      details: validation ? { issues: validation } : {},
      requestId,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      code: ApiErrorCode.NOT_FOUND,
      message: `No route for ${req.method} ${req.url}`,
      details: { method: req.method, url: req.url },
      requestId: req.id,
    });
  });

  // Phase 0 routes — each one is a typed skeleton. Later phases fill the handlers.
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerProjectRoutes(app);
  registerSubjectRoutes(app);
  registerConsentRoutes(app);
  registerVisitRoutes(app);
  registerEproRoutes(app);
  registerSafetyRoutes(app);
  registerRiskRoutes(app);
  registerDrugSampleRoutes(app);
  registerReportRoutes(app);
  registerDocumentRoutes(app);
  registerAiConfigRoutes(app);
  registerAuditRoutes(app);

  return app;
}

// Allow `node dist/server.js` to start the listener.
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith("server.js");

if (isMain) {
  const port = Number(process.env.PORT ?? 4000);
  buildServer()
    .then((app) => app.listen({ port, host: "0.0.0.0" }))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("failed to start api", err);
      process.exit(1);
    });
}