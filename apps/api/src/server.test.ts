import { describe, it, expect, afterAll } from "vitest";
import { buildServer } from "./server.js";
import { disconnectPrisma } from "./db.js";

describe("API server", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /healthz returns ok", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    await app.close();
  });

  it("Unknown route returns canonical error envelope", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(typeof body.message).toBe("string");
    expect(body.details).toBeDefined();
    expect(typeof body.requestId).toBe("string");
    await app.close();
  });

  it("All documented API surfaces are registered", async () => {
    const app = await buildServer();
    // Phase 1 routes that return real data.
    const live = [
      "/api/auth/session",
      "/api/projects",
    ];
    for (const url of live) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} should be registered`).not.toBe(404);
    }
    // Skeleton surfaces: registered but return canonical error envelope.
    const skeleton = [
      "/api/subjects",
      "/api/consent/documents",
      "/api/visits",
      "/api/epro/templates",
      "/api/risks",
      "/api/drugs/shipments",
      "/api/samples/transfers",
      "/api/reports",
      "/api/documents",
      "/api/ai-config/configs",
      "/api/audit/events",
      // /api/safety/events is now fully implemented in Phase 3.
      // It is verified by its own route file instead of via skeleton contract.
    ];
    for (const url of skeleton) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} should be registered`).not.toBe(404);
      const body = res.json();
      expect(body.code).toBeDefined();
      expect(body.requestId).toBeDefined();
    }
    // auth/login is POST-only.
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: {} });
    expect(login.statusCode, "/api/auth/login should be registered").not.toBe(404);
    expect(login.json().code).toBeDefined();
    await app.close();
  });
});
