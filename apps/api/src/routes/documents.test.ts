/**
 * Document route integration tests — Phase 3 Task 3.5.
 *
 * Covers the 5 endpoints in apps/api/src/routes/documents.ts:
 *
 *   GET    /api/documents
 *   GET    /api/documents/:documentId
 *   POST   /api/documents
 *   POST   /api/documents/:documentId/versions
 *   GET    /api/documents/:documentId/versions
 *
 * Demo path (all via HTTP):
 *   list → create (with initialVersion) → detail (with audit chain) →
 *   list-versions → upload a new version → currentVersionId updated.
 *
 * Cross-project isolation: a CRA on project A cannot read a document
 * owned by project B.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { Role } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `documents-test-${Date.now()}`;

interface Fixtures {
  // Roles with DocumentUpload + DocumentVersion.
  sponsorId: string;
  croPmId: string;
  piId: string;
  // Roles with DocumentRead but no upload.
  craId: string;
  auditorId: string;
  crcId: string;
  // Seeded document for the version-upload path.
  documentId: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const project = await prisma().project.create({
    data: {
      code: `TEST-${RUN_TAG}`,
      name: "Document route test project",
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
  const piId = await makeUser("pi-test", Role.SitePI);
  const craId = await makeUser("cra-test", Role.CRA);
  const auditorId = await makeUser("auditor-test", Role.Auditor);
  const crcId = await makeUser("crc-test", Role.SiteCRC);

  // Pre-create one document + initial version so the upload-version
  // path has a stable target. We tag with a unique title so the audit
  // chain is easy to trace back to the test fixture.
  const doc = await prisma().document.create({
    data: {
      projectId: project.id,
      title: `preloaded-${RUN_TAG}`,
      category: "Protocol",
      uploadedByUserId: sponsorId,
    },
  });
  const v = await prisma().documentVersion.create({
    data: {
      documentId: doc.id,
      version: "v1",
      fileUrl: "https://files.example.test/preloaded-v1.pdf",
      sha256: "a".repeat(64),
      uploadedByUserId: sponsorId,
    },
  });
  await prisma().document.update({
    where: { id: doc.id },
    data: { currentVersionId: v.id },
  });

  return {
    sponsorId,
    croPmId,
    piId,
    craId,
    auditorId,
    crcId,
    documentId: doc.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().exportRecord.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().documentVersion.deleteMany({
    where: { document: { project: { description: RUN_TAG } } },
  });
  await prisma().document.deleteMany({
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

const SHA = (s: string): string =>
  // Deterministic fake sha256 of length 64 derived from the seed.
  // Real workflows compute this from the file bytes; tests just need
  // a well-formed string the regex accepts.
  Array.from({ length: 64 }, (_, i) => s.charCodeAt(i % s.length) % 16)
    .map((b) => b.toString(16))
    .join("");

describe("Document routes", () => {
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

  /* ─── List ─────────────────────────────────────────────────── */

  it("list rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documents" });
    expect(res.statusCode).toBe(401);
  });

  it("list: CRA (DocumentRead) sees documents in their project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("list: filter by category returns only matching docs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents?category=Protocol",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(200);
    for (const item of res.json().items) {
      expect(item.category).toBe("Protocol");
    }
  });

  /* ─── Detail ───────────────────────────────────────────────── */

  it("detail: PI sees document + versions + audit chain", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/documents/${fix.documentId}`,
      ...asUser(fix.piId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.document.id).toBe(fix.documentId);
    expect(body.versions.length).toBe(1);
    expect(body.versions[0].isCurrent).toBe(true);
    expect(Array.isArray(body.auditTrail)).toBe(true);
  });

  it("detail: unknown id returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents/no-such-id",
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(404);
  });

  it("isolation: user from project A cannot read document in project B (403)", async () => {
    const other = await prisma().project.create({
      data: {
        code: `OTHER-${RUN_TAG}`,
        name: "Other project",
        sponsor: "Test",
        therapeuticArea: "Test",
        phase: "II",
        description: `${RUN_TAG}-OTHER`,
        startDate: new Date(),
      },
    });
    const otherDoc = await prisma().document.create({
      data: {
        projectId: other.id,
        title: `other-${RUN_TAG}`,
        category: "Manual",
        uploadedByUserId: fix.sponsorId,
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/documents/${otherDoc.id}`,
      ...asUser(fix.craId),
    });
    expect(res.statusCode).toBe(403);
    await prisma().document.delete({ where: { id: otherDoc.id } });
    await prisma().project.delete({ where: { id: other.id } });
  });

  /* ─── Create ───────────────────────────────────────────────── */

  it("create: SponsorAdmin can create a document with initial version", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents",
      ...asUser(fix.sponsorId),
      payload: {
        title: `ICF-v1-${RUN_TAG}`,
        category: "ICF",
        initialVersion: {
          version: "v1",
          fileUrl: "https://files.example.test/icf-v1.pdf",
          sha256: SHA("icf-v1"),
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.currentVersionId).toBeTruthy();

    // Audit chain on detail page should include the Document.create event.
    const detail = await app.inject({
      method: "GET",
      url: `/api/documents/${body.id}`,
      ...asUser(fix.craId),
    });
    const actions = detail.json().auditTrail.map(
      (a: { action: string }) => a.action,
    );
    expect(actions).toContain("create");
  });

  it("create: CRC (no DocumentUpload) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents",
      ...asUser(fix.crcId),
      payload: {
        title: `Manual-${RUN_TAG}`,
        category: "Manual",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("create: invalid category returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents",
      ...asUser(fix.sponsorId),
      payload: {
        title: "x",
        category: "NotARealCategory",
      },
    });
    expect(res.statusCode).toBe(422);
  });

  /* ─── Versions ─────────────────────────────────────────────── */

  it("upload-version: CROPM promotes a new version; currentVersionId updates", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.croPmId),
      payload: {
        version: "v2",
        fileUrl: "https://files.example.test/protocol-v2.pdf",
        sha256: SHA("protocol-v2"),
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isCurrent).toBe(true);
    expect(body.version).toBe("v2");

    const list = await app.inject({
      method: "GET",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.craId),
    });
    const listBody = list.json();
    expect(listBody.versions).toHaveLength(2);
    expect(listBody.currentVersionId).toBe(body.id);
  });

  it("upload-version: SitePI (has DocumentVersion) succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.piId),
      payload: {
        version: "v3",
        fileUrl: "https://files.example.test/protocol-v3.pdf",
        sha256: SHA("protocol-v3"),
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("upload-version: CRC (lacks DocumentVersion) is denied 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.crcId),
      payload: {
        version: "v4",
        fileUrl: "https://files.example.test/protocol-v4.pdf",
        sha256: SHA("protocol-v4"),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("upload-version: duplicate version label returns 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.sponsorId),
      payload: {
        version: "v3",
        fileUrl: "https://files.example.test/dup.pdf",
        sha256: SHA("dup"),
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("CONFLICT");
  });

  it("upload-version: bad sha256 returns 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${fix.documentId}/versions`,
      ...asUser(fix.sponsorId),
      payload: {
        version: "v5",
        fileUrl: "https://files.example.test/v5.pdf",
        sha256: "not-a-real-hash",
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it("upload-version writes both a DocumentVersion.create AND a Document.update audit event", async () => {
    // Use the API to create the document so the audit chain (create +
    // version.create + update) is generated by the route, not by
    // prisma directly. We assert each event by its object id and the
    // version.create's afterValue.documentId.
    const createRes = await app.inject({
      method: "POST",
      url: "/api/documents",
      ...asUser(fix.sponsorId),
      payload: {
        title: `audit-chain-${RUN_TAG}`,
        category: "Manual",
        initialVersion: {
          version: "v1",
          fileUrl: "https://files.example.test/audit-chain-v1.pdf",
          sha256: SHA("audit-chain-v1"),
        },
      },
    });
    expect(createRes.statusCode).toBe(200);
    const docId = createRes.json().id;
    const projectId = createRes.json().projectId as string;

    // Promote a second version. The create endpoint will write a
    // Document.update event with the version promotion; the v1 was
    // already current so the update's beforeValue is the v1 id, not
    // null. We only assert the audit chain structure here, not the
    // exact beforeValue.
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/documents/${docId}/versions`,
      ...asUser(fix.sponsorId),
      payload: {
        version: "v2",
        fileUrl: "https://files.example.test/audit-chain-v2.pdf",
        sha256: SHA("audit-chain-v2"),
      },
    });
    expect(uploadRes.statusCode).toBe(200);

    // Query the audit chain by projectId; the fixture project holds
    // only events from this test (cleanup deletes the project) so the
    // filter is unambiguous.
    const events = await prisma().auditEvent.findMany({
      where: { projectId, objectType: { in: ["DocumentVersion", "Document"] } },
      orderBy: { timestamp: "asc" },
    });
    const createEvent = events.find(
      (e: { objectType: string; action: string; afterValue: unknown }) => {
        if (e.objectType !== "DocumentVersion" || e.action !== "create") return false;
        const av = e.afterValue as { documentId?: string } | null;
        return av?.documentId === docId;
      },
    );
    const updateEvent = events.find(
      (e: { objectType: string; action: string; objectId: string }) =>
        e.objectType === "Document" && e.action === "update" && e.objectId === docId,
    );
    expect(createEvent).toBeTruthy();
    expect(updateEvent).toBeTruthy();
    const updateAfter = updateEvent?.afterValue as { currentVersionId: string };
    expect(updateAfter?.currentVersionId).toBeTruthy();
  });
});
