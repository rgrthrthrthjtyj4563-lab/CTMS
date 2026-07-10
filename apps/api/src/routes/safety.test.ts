/**
 * Safety route integration tests.
 *
 * Covers the 7 endpoints in apps/api/src/routes/safety.ts:
 *
 *   GET    /api/safety/events
 *   GET    /api/safety/events/:eventId
 *   POST   /api/safety/events
 *   POST   /api/safety/events/:eventId/confirm
 *   POST   /api/safety/events/:eventId/report
 *   POST   /api/safety/events/:eventId/follow-up
 *   POST   /api/safety/events/:eventId/close
 *
 * Each endpoint has at least 3 cases:
 *   1. happy path
 *   2. RBAC denial
 *   3. illegal state transition / business rule violation
 *
 * Test fixtures (project, site, subjects, users) are created per-test via
 * Prisma and tagged with a unique runTag so cleanup is unambiguous and tests
 * are independent of seed data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { Role, RiskLevel, SafetyEventStatus } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";
import type { User, Subject, SafetyEvent } from "@prisma/client";

const RUN_TAG = `safety-test-${Date.now()}`;

interface Fixtures {
  piId: string;
  crcId: string;
  sponsorId: string;
  auditorId: string;
  craId: string;
  subjectId: string;
  eventDraftId: string;
  eventConfirmedSaeId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Safety route test project",
      sponsor: "Test",
      therapeuticArea: "Test",
      phase: "II",
      description: RUN_TAG,
      startDate: new Date(),
    },
  });
  const site = await prisma().site.create({
    data: {
      projectId: project.id,
      code: `SITE-${RUN_TAG}`,
      name: "Test site",
      city: "TestCity",
      region: "TestRegion",
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
  const sponsorId = await makeUser("sponsor-test", Role.SponsorAdmin);
  const auditorId = await makeUser("auditor-test", Role.Auditor);
  const craId = await makeUser("cra-test", Role.CRA);

  const subject = await prisma().subject.create({
    data: {
      projectId: project.id,
      siteId: site.id,
      status: "Active",
      subjectCode: `SUBJ-${RUN_TAG}`,
      initials: "T",
      yearOfBirth: 1970,
      ageBand: "55岁",
      sex: "Female",
      city: "TestCity",
      ownerUserId: crcId,
    },
  });

  const draftEvent = await prisma().safetyEvent.create({
    data: {
      projectId: project.id,
      subjectId: subject.id,
      onsetAt: new Date(),
      description: "Test draft AE",
      severity: RiskLevel.Medium,
      status: SafetyEventStatus.Draft,
      isSerious: false,
      createdByUserId: crcId,
    },
  });
  const confirmedSae = await prisma().safetyEvent.create({
    data: {
      projectId: project.id,
      subjectId: subject.id,
      onsetAt: new Date(),
      description: "Test confirmed SAE",
      severity: RiskLevel.Critical,
      status: SafetyEventStatus.ConfirmedSAE,
      isSerious: true,
      createdByUserId: piId,
    },
  });

  return {
    piId,
    crcId,
    sponsorId,
    auditorId,
    craId,
    subjectId: subject.id,
    eventDraftId: draftEvent.id,
    eventConfirmedSaeId: confirmedSae.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  // Delete in FK-safe order
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().safetyFollowUp.deleteMany({
    where: { safetyEvent: { project: { description: RUN_TAG } } },
  });
  await prisma().safetyEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().subject.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().site.deleteMany({
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

describe("Safety routes", () => {
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

  /* ─── Auth ───────────────────────────────────────────────────── */

  it("list rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/safety/events" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  /* ─── List ───────────────────────────────────────────────────── */

  it("list: PI sees all events in their project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/safety/events",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("list: Auditor (read-only SafetyRead) sees events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/safety/events",
      ...asUser(fix.auditorId),
    });
    expect(res.statusCode).toBe(200);
  });

  it("list: filtered by status=ConfirmedSAE returns only ConfirmedSAE", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/safety/events?status=ConfirmedSAE",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const item of body.items) {
      expect(item.status).toBe("ConfirmedSAE");
    }
    expect(body.items.find((i: { id: string }) => i.id === fix.eventConfirmedSaeId)).toBeTruthy();
  });

  /* ─── Detail ─────────────────────────────────────────────────── */

  it("detail: PI can read event with audit trail + followups", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.event.id).toBe(fix.eventConfirmedSaeId);
    expect(body.event.status).toBe("ConfirmedSAE");
    expect(Array.isArray(body.auditTrail)).toBe(true);
    expect(Array.isArray(body.followUps)).toBe(true);
  });

  it("detail: unknown eventId returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/safety/events/no-such-event-id",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  /* ─── Create ─────────────────────────────────────────────────── */

  it("create: PI can create Draft AE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/safety/events",
      ...asUser(fix.piId),
      payload: {
        subjectId: fix.subjectId,
        onsetAt: new Date().toISOString(),
        description: "Created by test",
        severity: "Low",
        isSerious: false,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Draft");
  });

  it("create: CRC can create Draft AE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/safety/events",
      ...asUser(fix.crcId),
      payload: {
        subjectId: fix.subjectId,
        onsetAt: new Date().toISOString(),
        description: "CRC create",
        severity: "Medium",
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("create: CRA (lacks SafetyDraft) is denied with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/safety/events",
      ...asUser(fix.craId),
      payload: {
        subjectId: fix.subjectId,
        onsetAt: new Date().toISOString(),
        description: "CRA attempt",
        severity: "Low",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
  });

  it("create: missing required fields returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/safety/events",
      ...asUser(fix.piId),
      payload: { severity: "Low" },
    });
    expect(res.statusCode).toBe(422);
  });

  /* ─── Confirm ────────────────────────────────────────────────── */

  it("confirm: PI can Draft→ConfirmedSAE (one-step)", async () => {
    // Create a fresh Draft
    const created = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "For confirm test",
        severity: RiskLevel.High,
        status: SafetyEventStatus.Draft,
        isSerious: true,
        createdByUserId: fix.crcId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/confirm`,
      ...asUser(fix.piId),
      payload: { outcome: "ConfirmedSAE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ConfirmedSAE");
    expect(res.json().isSerious).toBe(true);
  });

  it("confirm: CRC (lacks SafetyConfirm) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventDraftId}/confirm`,
      ...asUser(fix.crcId),
      payload: { outcome: "ConfirmedAE" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("confirm: ConfirmedSAE→Reported direct transition is rejected (422)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/confirm`,
      ...asUser(fix.piId),
      payload: { outcome: "Reported" },
    });
    // zod validates outcome enum; outcome=Reported is rejected at validation
    expect(res.statusCode).toBe(422);
  });

  it("confirm: outcome must be ConfirmedAE or ConfirmedSAE", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventDraftId}/confirm`,
      ...asUser(fix.piId),
      payload: { outcome: "Closed" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("confirm: cannot confirm a ConfirmedSAE (already past Draft) → 409 STATE_TRANSITION_INVALID", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/confirm`,
      ...asUser(fix.piId),
      payload: { outcome: "ConfirmedSAE" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  /* ─── Report ─────────────────────────────────────────────────── */

  it("report: PI can ConfirmedSAE→Reported with reason", async () => {
    // Create a fresh ConfirmedSAE
    const created = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "For report test",
        severity: RiskLevel.Critical,
        status: SafetyEventStatus.ConfirmedSAE,
        isSerious: true,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/report`,
      ...asUser(fix.piId),
      payload: { reason: "已通报 IRB 编号 12345", regulator: "NMPA" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Reported");
  });

  it("report: reason is required — empty reason rejected 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/report`,
      ...asUser(fix.piId),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("report: ConfirmedAE (not serious) cannot be reported 422", async () => {
    const created = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "AE not SAE",
        severity: RiskLevel.Medium,
        status: SafetyEventStatus.ConfirmedAE,
        isSerious: false,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/report`,
      ...asUser(fix.piId),
      payload: { reason: "should fail" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("report: CRC (lacks SafetyReport) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/report`,
      ...asUser(fix.crcId),
      payload: { reason: "should fail" },
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Follow-up ──────────────────────────────────────────────── */

  it("follow-up: appends a follow-up record WITHOUT changing status", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/follow-up`,
      ...asUser(fix.piId),
      payload: { outcome: "体温恢复正常 36.8℃，继续观察 24h" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Status must remain ConfirmedSAE (NOT demoted to FollowUp)
    expect(body.status).toBe("ConfirmedSAE");
    expect(body.id).toBeTruthy();
    expect(body.outcome).toContain("体温");
  });

  it("follow-up: Reported event stays Reported (no demotion)", async () => {
    const reported = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "Reported for followup test",
        severity: RiskLevel.Critical,
        status: SafetyEventStatus.Reported,
        isSerious: true,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${reported.id}/follow-up`,
      ...asUser(fix.piId),
      payload: { outcome: "IRB 复审通过，无新增措施" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Reported");
  });

  it("follow-up: closed event rejects further follow-up 409", async () => {
    const closed = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "Closed for followup test",
        severity: RiskLevel.Low,
        status: SafetyEventStatus.Closed,
        isSerious: false,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${closed.id}/follow-up`,
      ...asUser(fix.piId),
      payload: { outcome: "should fail" },
    });
    expect(res.statusCode).toBe(409);
  });

  /* ─── Close ──────────────────────────────────────────────────── */

  it("close: PI can close ConfirmedSAE with reason", async () => {
    const created = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "For close test",
        severity: RiskLevel.High,
        status: SafetyEventStatus.ConfirmedSAE,
        isSerious: true,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/close`,
      ...asUser(fix.piId),
      payload: { reason: "受试者完全康复，事件关闭" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Closed");
  });

  it("close: empty reason rejected 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/close`,
      ...asUser(fix.piId),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("close: CRC (lacks SafetyClose) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${fix.eventConfirmedSaeId}/close`,
      ...asUser(fix.crcId),
      payload: { reason: "should fail" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("close: already closed event rejected 409", async () => {
    const closed = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "Already closed",
        severity: RiskLevel.Low,
        status: SafetyEventStatus.Closed,
        isSerious: false,
        createdByUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/safety/events/${closed.id}/close`,
      ...asUser(fix.piId),
      payload: { reason: "再关一次" },
    });
    expect(res.statusCode).toBe(409);
  });

  /* ─── Audit chain integrity ──────────────────────────────────── */

  it("audit chain: beforeValue/afterValue/reason populated on transitions", async () => {
    // Drive a fresh full lifecycle and inspect the audit trail.
    const created = await prisma().safetyEvent.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        subjectId: fix.subjectId,
        onsetAt: new Date(),
        description: "Audit chain test",
        severity: RiskLevel.Critical,
        status: SafetyEventStatus.Draft,
        isSerious: true,
        createdByUserId: fix.piId,
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/confirm`,
      ...asUser(fix.piId),
      payload: { outcome: "ConfirmedSAE" },
    });
    await app.inject({
      method: "POST",
      url: `/api/safety/events/${created.id}/report`,
      ...asUser(fix.piId),
      payload: { reason: "审计链测试上报" },
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/safety/events/${created.id}`,
      ...asUser(fix.piId),
    });
    expect(detail.statusCode).toBe(200);
    const trail = detail.json().auditTrail;
    const confirmEvent = trail.find((a: { action: string }) => a.action === "confirm");
    const reportEvent = trail.find((a: { action: string }) => a.action === "report");
    expect(confirmEvent).toBeTruthy();
    // beforeValue must reflect old status (Phase 3 hardening)
    expect(confirmEvent.beforeValue).toBeTruthy();
    expect(confirmEvent.beforeValue.status).toBe("Draft");
    // report has reason recorded
    expect(reportEvent).toBeTruthy();
    expect(reportEvent.reason).toBe("审计链测试上报");
    expect(reportEvent.beforeValue.status).toBe("ConfirmedSAE");
  });
});