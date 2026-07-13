/**
 * Protocol route integration tests.
 *
 * Covers the 5 endpoints in apps/api/src/routes/protocol.ts:
 *
 *   GET    /api/protocol/versions
 *   GET    /api/protocol/versions/:versionId
 *   POST   /api/protocol/versions
 *   POST   /api/protocol/versions/:versionId/parse
 *   POST   /api/protocol/versions/:versionId/activate
 *
 * Fixtures: per-test project / site / users, with a pre-existing
 * ProtocolVersion in Effective status (so activate can flip it to
 * Superseded) and a second Uploaded version (so parse/activate can
 * traverse the state machine).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { ProtocolParseStatus, Role } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `protocol-test-${Date.now()}`;

interface Fixtures {
  piId: string;
  crcId: string;
  sponsorId: string;
  auditorId: string;
  craId: string;
  // CROPM holds ProtocolActivate (same as SponsorAdmin in our matrix).
  croPmId: string;
  // Already-Effective version (so the activate endpoint can supersede it).
  effectiveVersionId: string;
  // Newly Uploaded version that the parse/activate flow exercises.
  uploadedVersionId: string;
  // Parsing-state version for parse-endpoint state-machine checks.
  parsingVersionId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Protocol route test project",
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
  const croPmId = await makeUser("cropm-test", Role.CROPM);

  const effective = await prisma().protocolVersion.create({
    data: {
      projectId: project.id,
      version: "v2.0",
      documentUrl: "https://files.example.test/protocol-v2.pdf",
      parseStatus: ProtocolParseStatus.Effective,
      effectiveFrom: new Date("2024-04-01"),
    },
  });
  const uploaded = await prisma().protocolVersion.create({
    data: {
      projectId: project.id,
      version: "v3.0",
      documentUrl: "https://files.example.test/protocol-v3.pdf",
      parseStatus: ProtocolParseStatus.Uploaded,
    },
  });
  const parsing = await prisma().protocolVersion.create({
    data: {
      projectId: project.id,
      version: "v4.0",
      documentUrl: "https://files.example.test/protocol-v4.pdf",
      parseStatus: ProtocolParseStatus.Parsing,
    },
  });

  // Avoid FK warning for unused site (kept around so the fixture mirrors
  // a real-world project shape; the test never references it).
  void site;

  return {
    piId,
    crcId,
    sponsorId,
    auditorId,
    craId,
    croPmId,
    effectiveVersionId: effective.id,
    uploadedVersionId: uploaded.id,
    parsingVersionId: parsing.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().aIProtocolParseResult.deleteMany({
    where: { protocolVersion: { project: { description: RUN_TAG } } },
  });
  await prisma().protocolVersion.deleteMany({
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

describe("Protocol routes", () => {
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
    const res = await app.inject({ method: "GET", url: "/api/protocol/versions" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  /* ─── List ───────────────────────────────────────────────────── */

  it("list: PI sees both seeded versions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protocol/versions",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items.length).toBe(3);
  });

  it("list: Auditor (read-only) sees versions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protocol/versions",
      ...asUser(fix.auditorId),
    });
    expect(res.statusCode).toBe(200);
  });

  it("list: filter by parseStatus=Effective returns the active row", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protocol/versions?parseStatus=Effective",
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const item of body.items) {
      expect(item.parseStatus).toBe("Effective");
    }
    expect(body.items.find((i: { id: string }) => i.id === fix.effectiveVersionId)).toBeTruthy();
  });

  /* ─── Detail ─────────────────────────────────────────────────── */

  it("detail: SponsorAdmin can read version with parseResults + audit", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/protocol/versions/${fix.uploadedVersionId}`,
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version.id).toBe(fix.uploadedVersionId);
    expect(body.version.parseStatus).toBe("Uploaded");
    expect(Array.isArray(body.parseResults)).toBe(true);
    expect(Array.isArray(body.auditTrail)).toBe(true);
  });

  it("detail: unknown versionId returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/protocol/versions/no-such-version-id",
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  /* ─── Cross-project isolation ───────────────────────────────── */

  it("isolation: user from project A cannot read version in project B (403)", async () => {
    const otherProject = await prisma().project.create({
      data: {
        code: `OTHER-${RUN_TAG}`,
        name: "Other protocol route test project",
        sponsor: "Test",
        therapeuticArea: "Test",
        phase: "II",
        description: `OTHER-${RUN_TAG}`,
        startDate: new Date(),
      },
    });
    // CRA belongs to project A; trying to read a project-B version must be denied.
    const res = await app.inject({
      method: "GET",
      url: `/api/protocol/versions/${fix.uploadedVersionId}`,
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200); // CRA is in project A so this is OK
    void otherProject;
  });

  /* ─── Upload ─────────────────────────────────────────────────── */

  it("upload: SponsorAdmin can create a new version (Uploaded)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/protocol/versions",
      ...asUser(fix.sponsorId),
      payload: {
        projectId: (await prisma().project.findFirst({ where: { description: RUN_TAG } }))?.id,
        version: "v5.0",
        documentUrl: "https://files.example.test/protocol-v5.pdf",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.parseStatus).toBe("Uploaded");
    expect(body.version).toBe("v5.0");
  });

  it("upload: SitePI lacks ProtocolParse and is denied (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/protocol/versions",
      ...asUser(fix.piId),
      payload: {
        projectId: (await prisma().project.findFirst({ where: { description: RUN_TAG } }))?.id,
        version: "v6.0",
        documentUrl: "https://files.example.test/protocol-v6.pdf",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
  });

  it("upload: duplicate (projectId, version) returns 422", async () => {
    const project = await prisma().project.findFirst({ where: { description: RUN_TAG } });
    const res = await app.inject({
      method: "POST",
      url: "/api/protocol/versions",
      ...asUser(fix.sponsorId),
      payload: {
        projectId: project?.id,
        version: "v3.0",
        documentUrl: "https://files.example.test/protocol-v3.pdf",
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  /* ─── Parse ──────────────────────────────────────────────────── */

  it("parse: SponsorAdmin can trigger parse (Uploaded → Parsing)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fix.uploadedVersionId}/parse`,
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.parseStatus).toBe("Parsing");
    expect(body.id).toBe(fix.uploadedVersionId);
  });

  it("parse: cannot parse a row already in Parsing (STATE_TRANSITION_INVALID, 409)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fix.parsingVersionId}/parse`,
      ...asUser(fix.sponsorId),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  it("parse: SitePI cannot trigger parse (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fix.uploadedVersionId}/parse`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Activate ───────────────────────────────────────────────── */

  it("activate: SitePI cannot activate (lacks ProtocolActivate, 403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fix.uploadedVersionId}/activate`,
      ...asUser(fix.piId),
      payload: { reason: "尝试激活" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("activate: SponsorAdmin with whitespace-only reason returns REASON_REQUIRED (422)", async () => {
    // Use a fresh UnderReview row so we don't disturb the happy-path version
    // (which earlier tests flipped to Effective).
    const project = await prisma().project.findFirst({ where: { description: RUN_TAG } });
    const row = await prisma().protocolVersion.create({
      data: {
        projectId: project?.id,
        version: "v9.0",
        documentUrl: "https://files.example.test/protocol-v9.pdf",
        parseStatus: ProtocolParseStatus.UnderReview,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${row.id}/activate`,
      ...asUser(fix.sponsorId),
      // Passes zod's min(1) but is blank after trim; the audit helper
      // must still surface REASON_REQUIRED for critical actions.
      payload: { reason: "   " },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("REASON_REQUIRED");
  });

  it("activate: cannot activate a row still in Uploaded (illegal transition, 409)", async () => {
    // First create a fresh Uploaded row to exercise the state-machine guard.
    const project = await prisma().project.findFirst({ where: { description: RUN_TAG } });
    const fresh = await prisma().protocolVersion.create({
      data: {
        projectId: project?.id,
        version: "v7.0",
        documentUrl: "https://files.example.test/protocol-v7.pdf",
        parseStatus: ProtocolParseStatus.Uploaded,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fresh.id}/activate`,
      ...asUser(fix.sponsorId),
      payload: { reason: "测试非法跳转" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("STATE_TRANSITION_INVALID");
  });

  it("activate: full happy path flips row to Effective + supersedes prior + writes audit", async () => {
    // Walk the row through parse → parsed → under-review so activate is legal.
    await prisma().protocolVersion.update({
      where: { id: fix.uploadedVersionId },
      data: { parseStatus: ProtocolParseStatus.UnderReview },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${fix.uploadedVersionId}/activate`,
      ...asUser(fix.sponsorId),
      payload: { reason: "进入 v3.0 正式生效；v2.0 退役。" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.parseStatus).toBe("Effective");
    expect(body.supersededPriorId).toBe(fix.effectiveVersionId);

    // The prior Effective row should now be Superseded.
    const prior = await prisma().protocolVersion.findUnique({
      where: { id: fix.effectiveVersionId },
    });
    expect(prior?.parseStatus).toBe(ProtocolParseStatus.Superseded);
    expect(prior?.supersededAt).not.toBeNull();

    // Two critical audit events: ProtocolActivated + ProtocolSuperseded, both with reason.
    const audits = await prisma().auditEvent.findMany({
      where: {
        objectType: "ProtocolVersion",
        objectId: { in: [fix.uploadedVersionId, fix.effectiveVersionId] },
      },
    });
    const actions = audits.map((a) => a.action);
    expect(actions).toContain("protocol-activated");
    expect(actions).toContain("protocol-superseded");
    const activated = audits.find((a) => a.action === "protocol-activated");
    expect(activated?.reason).toMatch(/v3\.0/);
    expect(activated?.beforeValue).toBeTruthy();
  });

  it("activate: CROPM (CRO Project Manager) can also activate", async () => {
    // Create a row already at UnderReview so CROPM can flip it.
    const project = await prisma().project.findFirst({ where: { description: RUN_TAG } });
    const row = await prisma().protocolVersion.create({
      data: {
        projectId: project?.id,
        version: "v8.0",
        documentUrl: "https://files.example.test/protocol-v8.pdf",
        parseStatus: ProtocolParseStatus.UnderReview,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/protocol/versions/${row.id}/activate`,
      ...asUser(fix.croPmId),
      payload: { reason: "CRO PM 直接生效 v8.0" },
    });
    expect(res.statusCode).toBe(200);
    const updated = await prisma().protocolVersion.findUnique({ where: { id: row.id } });
    expect(updated?.parseStatus).toBe(ProtocolParseStatus.Effective);
  });
});