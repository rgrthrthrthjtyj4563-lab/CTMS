/**
 * Audit route integration tests — Phase 3 Task 3.5.
 *
 * Covers the 3 endpoints in apps/api/src/routes/audit.ts:
 *
 *   GET  /api/audit/events
 *   GET  /api/audit/exports
 *   POST /api/audit/exports
 *
 * Demo path:
 *   list events (filter by objectType) → list exports (empty) →
 *   create export (with reason) → list exports (1 row) → confirm
 *   audit chain captured the export.
 *
 * Read-only roles (Auditor, CRA) get list; only Auditor + SponsorAdmin
 * can create exports. CROPM has AuditRead but not AuditExport.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { Role } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `audit-test-${Date.now()}`;

interface Fixtures {
  sponsorId: string;
  croPmId: string;
  auditorId: string;
  craId: string;
  // Pre-seeded audit event so the list filter test has stable data.
  seededEventId: string;
  // Pre-seeded ExportRecord so the list test sees an existing one.
  seededExportId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Audit route test project",
      sponsor: "Test",
      therapeuticArea: "Test",
      phase: "II",
      description: RUN_TAG,
      startDate: new Date(),
    },
  });

  async function makeUser(email: string, role: Role): Promise<string> {
    const u = await prisma().user.create({
      data: {
        email: `${email}-${RUN_TAG}`,
        displayName: email,
        organization: "TestOrg",
        roleAssignments: { create: [{ projectId: project.id, role }] },
      },
    });
    return u.id;
  }
  const sponsorId = await makeUser("sponsor-test", Role.SponsorAdmin);
  const croPmId = await makeUser("cropm-test", Role.CROPM);
  const auditorId = await makeUser("auditor-test", Role.Auditor);
  const craId = await makeUser("cra-test", Role.CRA);

  // Seed two audit events — one Safety, one Document — so the
  // objectType filter test has a deterministic universe to query.
  const evt = await prisma().auditEvent.create({
    data: {
      projectId: project.id,
      actorUserId: sponsorId,
      actorRole: Role.SponsorAdmin,
      objectType: "SafetyEvent",
      objectId: "safety-fixture",
      action: "create",
      afterValue: { fixture: true },
    },
  });
  await prisma().auditEvent.create({
    data: {
      projectId: project.id,
      actorUserId: croPmId,
      actorRole: Role.CROPM,
      objectType: "Document",
      objectId: "doc-fixture",
      action: "create",
      afterValue: { fixture: true },
    },
  });

  // Seed a pre-existing export record so the list-exports happy path
  // has at least one row to assert against.
  const exp = await prisma().exportRecord.create({
    data: {
      projectId: project.id,
      objectType: "AuditExport",
      objectIds: [],
      format: "PDF",
      reason: `seeded-fixture-${RUN_TAG}`,
      exportedByUserId: sponsorId,
    },
  });

  return {
    sponsorId,
    croPmId,
    auditorId,
    craId,
    seededEventId: evt.id,
    seededExportId: exp.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().exportRecord.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().roleAssignment.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().user.deleteMany({
    where: { roleAssignments: { every: { project: { description: RUN_TAG } } } },
  });
  await prisma().project.deleteMany({ where: { description: RUN_TAG } });
}

function asUser(userId: string): { headers: Record<string, string> } {
  return { headers: { "x-actor-id": userId } };
}

describe("Audit routes", () => {
  let app: FastifyInstance;
  let fix: Fixtures;

  beforeAll(async () => {
    fix = await setupFixtures();
    app = await buildServer();
  });

  afterAll(async () => {
    if (app) await app.close();
    await cleanupFixtures();
    await disconnectPrisma();
  });

  /* ─── Auth ──────────────────────────────────────────────────── */

  it("list events rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/events",
    });
    expect(res.statusCode).toBe(401);
  });

  /* ─── List events ──────────────────────────────────────────── */

  it("list events: CRA (AuditRead) sees the seeded events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/events",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("list events: filter by objectType=SafetyEvent returns only safety events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/events?objectType=SafetyEvent",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().items) {
      expect(item.objectType).toBe("SafetyEvent");
    }
  });

  it("list events: filter by action=create returns only create events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/events?action=create",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().items) {
      expect(item.action).toBe("create");
    }
  });

  it("list events: invalid objectType returns 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/events?objectType=NotARealObject",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(422);
  });

  /* ─── List exports ─────────────────────────────────────────── */

  it("list exports: Auditor sees the seeded export", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit/exports",
      ...asUser(fix.auditorId),
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(fix.seededExportId);
  });

  /* ─── Create export ───────────────────────────────────────── */

  it("create export: Auditor writes an export with reason + filters", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/exports",
      ...asUser(fix.auditorId),
      payload: {
        reason: "提交给 FDA 现场核查",
        format: "CSV",
        filters: { objectType: "SafetyEvent" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reason).toBe("提交给 FDA 现场核查");
    expect(body.format).toBe("CSV");
    expect(body.exportedByUserId).toBe(fix.auditorId);

    // Audit chain: the export action MUST appear in the events list
    // with reason attached. This is the 21 CFR Part 11 contract.
    const detail = await app.inject({
      method: "GET",
      url: "/api/audit/events?action=export&objectType=AuditExport",
      ...asUser(fix.craId),
    });
    const auditEvents = detail.json().items as Array<{
      objectId: string;
      reason: string | null;
    }>;
    expect(auditEvents.some((e) => e.objectId === body.id && e.reason === body.reason)).toBe(
      true,
    );
  });

  it("create export: missing reason returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/exports",
      ...asUser(fix.auditorId),
      payload: { reason: "", format: "PDF" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("create export: CROPM (lacks AuditExport) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/exports",
      ...asUser(fix.croPmId),
      payload: { reason: "should fail", format: "PDF" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("create export: SponsorAdmin (has AuditExport) succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/exports",
      ...asUser(fix.sponsorId),
      payload: { reason: "内部合规审查", format: "JSON" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("create export writes BOTH an ExportRecord and a critical AuditEvent with reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/exports",
      ...asUser(fix.auditorId),
      payload: {
        reason: "链式审计验证",
        format: "XLSX",
        filters: { objectType: "Document" },
      },
    });
    expect(res.statusCode).toBe(200);
    const exportRecordId = res.json().id;

    const [exportRecord, auditEvents] = await Promise.all([
      prisma().exportRecord.findUnique({ where: { id: exportRecordId } }),
      prisma().auditEvent.findMany({
        where: { objectType: "AuditExport", objectId: exportRecordId },
      }),
    ]);
    expect(exportRecord).not.toBeNull();
    expect(exportRecord?.reason).toBe("链式审计验证");
    expect(exportRecord?.format).toBe("XLSX");
    expect(exportRecord?.objectType).toBe("AuditExport");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.action).toBe("export");
    expect(auditEvents[0]?.reason).toBe("链式审计验证");
  });
});
