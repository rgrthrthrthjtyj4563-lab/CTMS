/**
 * Report route integration tests.
 *
 * Covers the 5 endpoints in apps/api/src/routes/reports.ts:
 *
 *   GET    /api/reports
 *   GET    /api/reports/:reportId
 *   POST   /api/reports
 *   POST   /api/reports/:reportId/confirm
 *   POST   /api/reports/:reportId/export
 *
 * Demo path (all via HTTP, no BullMQ/Redis):
 *   generate → (worker flip to Draft) → confirm → export.
 *
 * The worker is exercised in its own package; here we test the API
 * surface only. We pre-create a Draft row to test the confirm path, and
 * drive the Generating→Draft transition manually when the test needs a
 * Draft row. This mirrors how protocol tests treat the parse queue.
 *
 * Fixtures are tagged with a unique runTag so cleanup is unambiguous.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { ReportStatus, Role } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `report-test-${Date.now()}`;

interface Fixtures {
  // Roles with ReportRead but no mutation perms.
  piId: string;
  crcId: string;
  craId: string;
  auditorId: string;
  // Roles with all 3 report mutation perms.
  sponsorId: string;
  croPmId: string;
  // Seeded reports in different statuses.
  generatingReportId: string;
  draftReportId: string;
  confirmedReportId: string;
  exportedReportId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Report route test project",
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
  const piId = await makeUser("pi-test", Role.SitePI);
  const crcId = await makeUser("crc-test", Role.SiteCRC);
  const craId = await makeUser("cra-test", Role.CRA);
  const auditorId = await makeUser("auditor-test", Role.Auditor);
  const sponsorId = await makeUser("sponsor-test", Role.SponsorAdmin);
  const croPmId = await makeUser("cropm-test", Role.CROPM);

  // Pre-create reports in the four states that matter for state-machine
  // coverage. We tag them with a description so the audit chain on
  // confirm/export links back to the test fixture.
  const generating = await prisma().reportDraft.create({
    data: {
      projectId: project.id,
      type: "Interim",
      status: ReportStatus.Generating,
    },
  });
  const draft = await prisma().reportDraft.create({
    data: {
      projectId: project.id,
      type: "Interim",
      status: ReportStatus.Draft,
    },
  });
  const confirmed = await prisma().reportDraft.create({
    data: {
      projectId: project.id,
      type: "Final",
      status: ReportStatus.Confirmed,
      confirmedAt: new Date(),
    },
  });
  const exported = await prisma().reportDraft.create({
    data: {
      projectId: project.id,
      type: "Safety",
      status: ReportStatus.Exported,
      confirmedAt: new Date(Date.now() - 60_000),
      exportedAt: new Date(),
    },
  });

  return {
    piId,
    crcId,
    craId,
    auditorId,
    sponsorId,
    croPmId,
    generatingReportId: generating.id,
    draftReportId: draft.id,
    confirmedReportId: confirmed.id,
    exportedReportId: exported.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  // Delete in FK-safe order.
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().exportRecord.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().aICallLog.deleteMany({
    where: { aiOutput: { project: { description: RUN_TAG } } },
  });
  await prisma().aIOutput.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().reportDraft.deleteMany({
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

describe("Report routes", () => {
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

  /* ─── Auth ─────────────────────────────────────────────────── */

  it("list rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/reports" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  /* ─── List ─────────────────────────────────────────────────── */

  it("list: PI (ReportRead) sees all reports in their project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.items.length).toBeGreaterThanOrEqual(4);
    for (const item of body.items) {
      expect(item.id).toBeTruthy();
      expect(item.status).toBeTruthy();
    }
  });

  it("list: filtered by status=Draft returns only Draft", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports?status=Draft",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const item of body.items) {
      expect(item.status).toBe("Draft");
    }
  });

  /* ─── Detail ───────────────────────────────────────────────── */

  it("detail: PI sees report + audit chain", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/reports/${fix.confirmedReportId}`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.report.id).toBe(fix.confirmedReportId);
    expect(body.report.status).toBe("Confirmed");
    expect(Array.isArray(body.auditTrail)).toBe(true);
  });

  it("detail: unknown reportId returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports/no-such-report-id",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("isolation: user from project A cannot read report in project B (403)", async () => {
    const otherProject = await prisma().project.create({
      data: {
        code: `OTHER-${RUN_TAG}`,
        name: "Other report route test project",
        sponsor: "Test",
        therapeuticArea: "Test",
        phase: "II",
        description: `${RUN_TAG}-OTHER`,
        startDate: new Date(),
      },
    });
    const otherReport = await prisma().reportDraft.create({
      data: {
        projectId: otherProject.id,
        type: "Interim",
        status: ReportStatus.Draft,
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/reports/${otherReport.id}`,
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
    await prisma().reportDraft.delete({ where: { id: otherReport.id } });
    await prisma().project.delete({ where: { id: otherProject.id } });
  });

  /* ─── Generate ─────────────────────────────────────────────── */

  it("generate: SponsorAdmin can create a Generating report", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports",
      ...asUser(fix.sponsorId),
      payload: { type: "Interim" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Generating");
    expect(res.json().type).toBe("Interim");
  });

  it("generate: CRC (lacks ReportGenerate) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports",
      ...asUser(fix.crcId),
      payload: { type: "Interim" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("generate: invalid type returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports",
      ...asUser(fix.sponsorId),
      payload: { type: "NotARealType" },
    });
    expect(res.statusCode).toBe(422);
  });

  /* ─── Confirm ──────────────────────────────────────────────── */

  it("confirm: SponsorAdmin can walk Draft → UnderReview → Confirmed", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.draftReportId}/confirm`,
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Confirmed");
    expect(res.json().confirmedAt).toBeTruthy();

    // Audit chain records BOTH transitions + the confirm event.
    const detail = await app.inject({
      method: "GET",
      url: `/api/reports/${fix.draftReportId}`,
      ...asUser(fix.piId),
    });
    const body = detail.json();
    const actions = body.auditTrail.map(
      (a: { action: string }) => a.action,
    );
    expect(actions).toContain("confirm");
    expect(actions).toContain("status-change");
  });

  it("confirm: from Generating rejected 409 (must be Draft first)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.generatingReportId}/confirm`,
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  it("confirm: PI (lacks ReportConfirm) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.draftReportId}/confirm`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Export ───────────────────────────────────────────────── */

  it("export: CROPM can walk Confirmed → Exported with reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.confirmedReportId}/export`,
      ...asUser(fix.croPmId),
      payload: { reason: "需要提交给伦理委员会审查", format: "PDF" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Exported");
    expect(res.json().exportedAt).toBeTruthy();
    expect(res.json().exportRecordId).toBeTruthy();
  });

  it("export: missing reason returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.confirmedReportId}/export`,
      ...asUser(fix.croPmId),
      payload: { reason: "", format: "PDF" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("export: unconfirmed report (Draft) cannot be exported (409)", async () => {
    // Create a fresh Draft to confirm the guard. The seeded draft was
    // already confirmed by an earlier test, so we need a new one.
    const freshDraft = await prisma().reportDraft.create({
      data: {
        projectId: (await prisma().reportDraft.findUnique({
          where: { id: fix.confirmedReportId },
        }))!.projectId,
        type: "Interim",
        status: ReportStatus.Draft,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${freshDraft.id}/export`,
      ...asUser(fix.croPmId),
      payload: { reason: "should fail", format: "PDF" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  it("export: PI (lacks ReportExport) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/reports/${fix.confirmedReportId}/export`,
      ...asUser(fix.piId),
      payload: { reason: "should fail RBAC", format: "PDF" },
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Audit chain + ExportRecord ──────────────────────────── */

  it("export writes BOTH an ExportRecord and a critical AuditEvent with reason", async () => {
    // Build a fresh report, walk it through to Confirmed, then export.
    const fresh = await prisma().reportDraft.create({
      data: {
        projectId: (await prisma().reportDraft.findUnique({
          where: { id: fix.confirmedReportId },
        }))!.projectId,
        type: "Interim",
        status: ReportStatus.Draft,
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/reports/${fresh.id}/confirm`,
      ...asUser(fix.sponsorId),
    });
    const exportRes = await app.inject({
      method: "POST",
      url: `/api/reports/${fresh.id}/export`,
      ...asUser(fix.croPmId),
      payload: { reason: "审计链验证", format: "CSV" },
    });
    expect(exportRes.statusCode).toBe(200);
    const exportRecordId = exportRes.json().exportRecordId;

    const [exportRecord, auditEvents] = await Promise.all([
      prisma().exportRecord.findUnique({ where: { id: exportRecordId } }),
      prisma().auditEvent.findMany({
        where: { objectType: "ReportDraft", objectId: fresh.id },
        orderBy: { timestamp: "desc" },
      }),
    ]);
    expect(exportRecord).not.toBeNull();
    expect(exportRecord?.reason).toBe("审计链验证");
    expect(exportRecord?.format).toBe("CSV");
    expect(exportRecord?.objectIds).toEqual([fresh.id]);
    const exportAudit = auditEvents.find(
      (a: { action: string; reason: string | null }) => a.action === "export",
    );
    expect(exportAudit).toBeTruthy();
    expect(exportAudit?.reason).toBe("审计链验证");
  });
});
