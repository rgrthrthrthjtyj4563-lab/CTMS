/**
 * Risk route integration tests.
 *
 * Covers the 6 endpoints in apps/api/src/routes/risks.ts:
 *
 *   GET    /api/risks
 *   GET    /api/risks/:riskId
 *   POST   /api/risks/:riskId/assign
 *   POST   /api/risks/:riskId/resolve
 *   POST   /api/risks/:riskId/close
 *   POST   /api/risks/:riskId/reject
 *
 * Fixtures: per-test project / site / subjects / users / risk signals,
 * tagged with a unique runTag so cleanup is unambiguous.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { Role, RiskLevel, RiskStatus } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `risk-test-${Date.now()}`;

interface Fixtures {
  piId: string;
  crcId: string;
  auditorId: string;
  craId: string;
  // CROPM fixture: has RiskClose (PI and CRC do NOT have RiskClose).
  croPmId: string;
  subjectId: string;
  // Open risk (PI is owner) — for assign/resolve/close
  openRiskId: string;
  // Open risk with Critical level (for reject + audit reason checks)
  criticalRiskId: string;
  // Resolved risk — for close testing
  resolvedRiskId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Risk route test project",
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
  const auditorId = await makeUser("auditor-test", Role.Auditor);
  const craId = await makeUser("cra-test", Role.CRA);
  // CROPM holds RiskClose (and a CROPM is allowed to close high-risk
  // items from the operations desk). SitePI does NOT.
  const croPmId = await makeUser("cropm-test", Role.CROPM);

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

  const openRisk = await prisma().riskSignal.create({
    data: {
      projectId: project.id,
      level: RiskLevel.High,
      type: "AE未处理",
      objectType: "SafetyEvent",
      objectId: subject.id,
      subjectId: subject.id,
      trigger: "测试触发：受试者7日内未完成SAE上报",
      suggestion: "立即通知研究者完成SAE上报。",
      ownerUserId: piId,
      status: RiskStatus.Open,
      deadline: new Date(Date.now() + 3 * 86400e3),
    },
  });
  const criticalRisk = await prisma().riskSignal.create({
    data: {
      projectId: project.id,
      level: RiskLevel.Critical,
      type: "访视超窗",
      objectType: "Visit",
      objectId: subject.id,
      subjectId: subject.id,
      trigger: "测试触发：V4访视超出时间窗±7天（已超14天）",
      suggestion: "安排补救访视或记录方案偏离。",
      ownerUserId: piId,
      status: RiskStatus.Open,
      deadline: new Date(Date.now() + 1 * 86400e3),
    },
  });
  const resolvedRisk = await prisma().riskSignal.create({
    data: {
      projectId: project.id,
      level: RiskLevel.Medium,
      type: "ePRO缺失",
      objectType: "Subject",
      objectId: subject.id,
      subjectId: subject.id,
      trigger: "测试触发：连续3次ePRO未按时填写",
      suggestion: "CRC电话提醒。",
      ownerUserId: crcId,
      status: RiskStatus.Resolved,
      deadline: new Date(Date.now() - 1 * 86400e3),
    },
  });

  return {
    piId,
    crcId,
    auditorId,
    craId,
    croPmId,
    subjectId: subject.id,
    openRiskId: openRisk.id,
    criticalRiskId: criticalRisk.id,
    resolvedRiskId: resolvedRisk.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().riskHandlingRecord.deleteMany({
    where: { riskSignal: { project: { description: RUN_TAG } } },
  });
  await prisma().riskSignal.deleteMany({
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

describe("Risk routes", () => {
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

  it("list rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/risks" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  /* ─── List ──────────────────────────────────────────────────── */

  it("list: PI sees project risk signals with pagination metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/risks",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    // Each row exposes the minimum shape the UI needs
    for (const item of body.items) {
      expect(item.id).toBeTruthy();
      expect(item.level).toBeTruthy();
      expect(item.status).toBeTruthy();
      expect(typeof item.handlingCount).toBe("number");
    }
  });

  it("list: filtered by status=Open returns only Open", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/risks?status=Open",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const item of body.items) {
      expect(item.status).toBe("Open");
    }
  });

  it("list: Auditor (RiskRead only) sees read-only risk worklist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/risks",
      ...asUser(fix.auditorId),
    });
    expect(res.statusCode).toBe(200);
  });

  /* ─── Detail ────────────────────────────────────────────────── */

  it("detail: PI sees risk + handling history + audit chain", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/risks/${fix.openRiskId}`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.risk.id).toBe(fix.openRiskId);
    expect(body.risk.status).toBe("Open");
    expect(Array.isArray(body.handling)).toBe(true);
    expect(Array.isArray(body.auditTrail)).toBe(true);
    expect(body.aiOutput).toBeNull();
  });

  it("detail: unknown riskId returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/risks/no-such-risk-id",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("isolation: user from project A cannot read risk in project B (403)", async () => {
    // Build a sibling project + risk. CRA is in project A; reading the
    // B-project risk must be denied even though CRA has RiskRead globally.
    const otherProject = await prisma().project.create({
      data: {
        code: `OTHER-${RUN_TAG}`,
        name: "Other risk route test project",
        sponsor: "Test",
        therapeuticArea: "Test",
        phase: "II",
        description: `${RUN_TAG}-OTHER`,
        startDate: new Date(),
      },
    });
    const otherRisk = await prisma().riskSignal.create({
      data: {
        projectId: otherProject.id,
        level: RiskLevel.Low,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        trigger: "Other project risk",
        status: RiskStatus.Open,
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/risks/${otherRisk.id}`,
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
    // cleanup so the test order doesn't leak state
    await prisma().riskSignal.delete({ where: { id: otherRisk.id } });
    await prisma().project.delete({ where: { id: otherProject.id } });
  });

  /* ─── Assign ────────────────────────────────────────────────── */

  it("assign: PI can Open→Assigned with an owner", async () => {
    // Create a fresh Open risk so we don't disturb other tests.
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Medium,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Assign test fresh",
        status: RiskStatus.Open,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/assign`,
      ...asUser(fix.piId),
      payload: { ownerUserId: fix.crcId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Assigned");
    expect(res.json().ownerUserId).toBe(fix.crcId);
  });

  it("assign: CRC (lacks RiskAssign) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fix.openRiskId}/assign`,
      ...asUser(fix.crcId),
      payload: { ownerUserId: fix.crcId },
    });
    expect(res.statusCode).toBe(403);
  });

  it("assign: missing ownerUserId returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fix.openRiskId}/assign`,
      ...asUser(fix.piId),
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  /* ─── Resolve ───────────────────────────────────────────────── */

  it("resolve: PI walks Open→Assigned→InProgress→Resolved with reason", async () => {
    // Create a fresh risk and walk it through the legal state machine.
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Medium,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Resolve test fresh",
        status: RiskStatus.Open,
        ownerUserId: fix.piId,
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/assign`,
      ...asUser(fix.piId),
      payload: { ownerUserId: fix.piId },
    });
    // InProgress is the work-in-flight state; the API has no explicit
    // endpoint for entering it (it's set when the owner picks up the
    // assignment), so we drive it through the database.
    await prisma().riskSignal.update({
      where: { id: fresh.id },
      data: { status: RiskStatus.InProgress },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/resolve`,
      ...asUser(fix.piId),
      payload: { reason: "电话提醒受试者后已填写" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Resolved");
  });

  it("resolve: must come from InProgress/PendingInvestigator (Assigned→Resolved rejected 409)", async () => {
    // resolvedRisk fixture is already Resolved; create a fresh Assigned one
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Low,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Resolve guard test",
        status: RiskStatus.Assigned,
        ownerUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/resolve`,
      ...asUser(fix.piId),
      payload: { reason: "should fail transition" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  /* ─── Close ─────────────────────────────────────────────────── */

  it("close: CROPM can Resolved→Closed with reason (RiskClose is CROPM/Sponsor)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fix.resolvedRiskId}/close`,
      ...asUser(fix.croPmId),
      payload: { reason: "已与受试者电话沟通并补全 ePRO" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Closed");
  });

  it("close: empty reason rejected 422", async () => {
    // Create a fresh Resolved risk specifically for this test
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Low,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Close-reason test",
        status: RiskStatus.Resolved,
        ownerUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/close`,
      ...asUser(fix.croPmId),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("close: PI (lacks RiskClose) is denied 403; only CROPM/Sponsor can close", async () => {
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Low,
        type: "数据质量",
        objectType: "Subject",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Close-RBAC test",
        status: RiskStatus.Resolved,
        ownerUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/close`,
      ...asUser(fix.piId),
      payload: { reason: "should fail RBAC" },
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Reject ────────────────────────────────────────────────── */

  it("reject: CROPM can Open→Rejected with reason (RiskClose is CROPM/Sponsor)", async () => {
    // Create a fresh Open risk to reject
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.High,
        type: "AE未处理",
        objectType: "SafetyEvent",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Reject test",
        suggestion: "建议处理",
        status: RiskStatus.Open,
        ownerUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/reject`,
      ...asUser(fix.croPmId),
      payload: { reason: "误报：受试者实际已完成上报" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("Rejected");
  });

  it("reject: empty reason rejected 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${fix.criticalRiskId}/reject`,
      ...asUser(fix.croPmId),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("reject: from Closed state rejected 409", async () => {
    const closed = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.Medium,
        type: "AE未处理",
        objectType: "SafetyEvent",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Closed-reject test",
        status: RiskStatus.Closed,
        ownerUserId: fix.piId,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/risks/${closed.id}/reject`,
      ...asUser(fix.croPmId),
      payload: { reason: "should fail" },
    });
    expect(res.statusCode).toBe(409);
  });

  /* ─── Audit chain ───────────────────────────────────────────── */

  it("audit chain: every transition writes both a RiskHandlingRecord and an AuditEvent", async () => {
    const fresh = await prisma().riskSignal.create({
      data: {
        projectId: (await prisma().subject.findUnique({ where: { id: fix.subjectId } }))!.projectId,
        level: RiskLevel.High,
        type: "AE未处理",
        objectType: "SafetyEvent",
        objectId: fix.subjectId,
        subjectId: fix.subjectId,
        trigger: "Audit chain test",
        status: RiskStatus.Open,
        ownerUserId: fix.piId,
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/assign`,
      ...asUser(fix.piId),
      payload: { ownerUserId: fix.piId },
    });
    // Walk the state machine cleanly: Assigned → InProgress (via direct
    // prisma update — there's no explicit endpoint for it; the API only
    // exposes the user-facing transitions and the InProgress transition
    // is reached when the assignee picks up the work).
    await prisma().riskSignal.update({
      where: { id: fresh.id },
      data: { status: RiskStatus.InProgress },
    });
    await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/resolve`,
      ...asUser(fix.piId),
      payload: { reason: "已处理" },
    });
    await app.inject({
      method: "POST",
      url: `/api/risks/${fresh.id}/close`,
      ...asUser(fix.croPmId),
      payload: { reason: "可关闭" },
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/risks/${fresh.id}`,
      ...asUser(fix.piId),
    });
    const body = detail.json();
    const handlingActions = body.handling.map((h: { action: string }) => h.action);
    expect(handlingActions).toContain("assign");
    expect(handlingActions).toContain("resolve");
    expect(handlingActions).toContain("close");
    const auditActions = body.auditTrail.map((a: { action: string }) => a.action);
    expect(auditActions).toContain("assign");
    expect(auditActions).toContain("resolve");
    expect(auditActions).toContain("close");
  });
});
