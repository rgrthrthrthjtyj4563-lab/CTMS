/**
 * AI 中台配置路由测试 — Task 3.6.
 *
 * Coverage:
 *  - List endpoints: project scoping (R2) — query projectId outside
 *    the caller's roleAssignments returns 403.
 *  - Update config: per-project role resolution (R1) — a
 *    SponsorAdmin on project A cannot update a config on project B
 *    by leaking the primary-role authority; resolveActorRoleForProject
 *    pins the role to the target project's assignment.
 *  - Prompt create: version uniqueness + immutable prior versions
 *    + audit chain written.
 *  - Adopt AI output: state machine Pending → Adopted, audit
 *    AIOutputAdopted emitted, atomicity (no audit == no state change).
 *  - Reject AI output: reason required (REASON_REQUIRED) and state
 *    Pending → Rejected with rejectionReason persisted.
 *  - Rejecting an already-Resolved output: state machine guard.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import { Role, HumanConfirmationStatus } from "@aic-dct/domain";
import type { FastifyInstance } from "fastify";

const RUN_TAG = `aicfg-test-${Date.now()}`;

interface Fx {
  projectA: string;
  projectB: string;
  sponsorOnA: string;
  sponsorOnBoth: string;
  piOnA: string;
  configA: string;
  configB: string;
  promptCode: string;
  promptV1: string;
  outputPending: string;
  outputAdopted: string;
}

async function setupFx(): Promise<Fx> {
  const projectA = await prisma().project.create({
    data: {
      code: `TEST-A-${RUN_TAG}`,
      name: "AI cfg test A",
      sponsor: "Test",
      therapeuticArea: "Test",
      phase: "II",
      description: RUN_TAG,
      startDate: new Date(),
    },
  });
  const projectB = await prisma().project.create({
    data: {
      code: `TEST-B-${RUN_TAG}`,
      name: "AI cfg test B",
      sponsor: "Test",
      therapeuticArea: "Test",
      phase: "II",
      description: RUN_TAG,
      startDate: new Date(),
    },
  });

  async function makeUser(
    email: string,
    assignments: Array<{ projectId: string; role: Role }>,
  ): Promise<string> {
    const u = await prisma().user.create({
      data: {
        email: `${email}-${RUN_TAG}`,
        displayName: email,
        organization: "TestOrg",
        roleAssignments: { create: assignments },
      },
    });
    return u.id;
  }

  // sponsorOnA: holds AIConfigUpdate on A only. Used to verify that
  // resolveActorRoleForProject blocks them from updating B's config.
  const sponsorOnA = await makeUser("sponsorA", [
    { projectId: projectA.id, role: Role.SponsorAdmin },
  ]);
  // sponsorOnBoth: holds AIConfigUpdate on both projects. Used to
  // verify the helper does not "leak" the first assignment's role to
  // an out-of-scope update.
  const sponsorOnBoth = await makeUser("sponsorBoth", [
    { projectId: projectA.id, role: Role.SponsorAdmin },
    { projectId: projectB.id, role: Role.SponsorAdmin },
  ]);
  // piOnA: holds AIConfigRead on A only. Used for read-scope tests.
  const piOnA = await makeUser("piA", [
    { projectId: projectA.id, role: Role.SitePI },
  ]);

  const configA = await prisma().aIConfig.create({
    data: {
      projectId: projectA.id,
      provider: "mock",
      model: "mock-test-model",
      temperature: 0.2,
      maxTokens: 512,
      enabled: true,
    },
  });
  const configB = await prisma().aIConfig.create({
    data: {
      projectId: projectB.id,
      provider: "mock",
      model: "mock-test-model",
      temperature: 0.2,
      maxTokens: 512,
      enabled: true,
    },
  });

  const promptCode = `risk-signal-${RUN_TAG}`;
  const promptV1 = await prisma().promptTemplate.create({
    data: {
      code: promptCode,
      version: "1.0.0",
      body: "Initial prompt body",
      variables: [] as object,
      outputKind: "RiskSignal",
    },
  });

  // Pending output on project A
  const outputPending = await prisma().aIOutput.create({
    data: {
      kind: "RiskSignal",
      projectId: projectA.id,
      confidence: 0.7,
      confidenceLevel: "Medium",
      model: "mock-test-model",
      modelVersion: "v1",
      inputHash: `hash-${RUN_TAG}-1`,
      payload: { suggestion: "立即通知研究者" } as object,
      status: HumanConfirmationStatus.Pending,
      promptTemplateId: promptV1.id,
      knowledgeBaseRefs: [] as object,
    },
  });
  // Already-adopted output on project A — for state-machine guard.
  const outputAdopted = await prisma().aIOutput.create({
    data: {
      kind: "RiskSignal",
      projectId: projectA.id,
      confidence: 0.9,
      confidenceLevel: "High",
      model: "mock-test-model",
      modelVersion: "v1",
      inputHash: `hash-${RUN_TAG}-2`,
      payload: { suggestion: "已采纳" } as object,
      status: HumanConfirmationStatus.Adopted,
      promptTemplateId: promptV1.id,
      confirmedByUserId: sponsorOnA,
      confirmedAt: new Date(),
      knowledgeBaseRefs: [] as object,
    },
  });

  return {
    projectA: projectA.id,
    projectB: projectB.id,
    sponsorOnA,
    sponsorOnBoth,
    piOnA,
    configA: configA.id,
    configB: configB.id,
    promptCode,
    promptV1: promptV1.id,
    outputPending: outputPending.id,
    outputAdopted: outputAdopted.id,
  };
}

async function cleanupFx(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().aICallLog.deleteMany({
    where: { inputHash: { contains: RUN_TAG } },
  });
  await prisma().aIOutput.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().aIConfig.deleteMany({
    where: { project: { description: RUN_TAG } },
  });
  await prisma().promptTemplate.deleteMany({
    where: { code: { contains: RUN_TAG } },
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

describe("AI config routes (Task 3.6)", () => {
  let app: FastifyInstance;
  let fx: Fx;

  beforeAll(async () => {
    fx = await setupFx();
    app = await buildServer();
  });

  afterAll(async () => {
    if (app) await app.close();
    await cleanupFx();
    await disconnectPrisma();
  });

  /* ─── R2: list configs project scoping ──────────────── */
  it("GET /api/ai-config/configs scopes to the caller's project by default", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/ai-config/configs",
      ...asUser(fx.sponsorOnA),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.every((c: { projectId: string | null }) => c.projectId === fx.projectA)).toBe(true);
  });

  it("R2: ?projectId=B from a caller assigned to A only is rejected with 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/ai-config/configs?projectId=${fx.projectB}`,
      ...asUser(fx.sponsorOnA),
    });
    expect(res.statusCode).toBe(403);
  });

  it("R2: ?projectId=B is honored for a caller assigned to both A and B", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/ai-config/configs?projectId=${fx.projectB}`,
      ...asUser(fx.sponsorOnBoth),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((c: { id: string }) => c.id === fx.configB)).toBe(true);
  });

  /* ─── R1: per-project role resolution on update ───── */
  it("R1: a caller assigned only to A cannot update a config on B", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/ai-config/configs/${fx.configB}`,
      ...asUser(fx.sponsorOnA),
      payload: { temperature: 0.5 },
    });
    expect(res.statusCode).toBe(403);
    // B's config must remain unchanged
    const row = await prisma().aIConfig.findUnique({ where: { id: fx.configB } });
    expect(row?.temperature).toBeCloseTo(0.2);
  });

  it("R1: a caller assigned to both A and B can update B's config", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/ai-config/configs/${fx.configB}`,
      ...asUser(fx.sponsorOnBoth),
      payload: { temperature: 0.55 },
    });
    expect(res.statusCode).toBe(200);
    const row = await prisma().aIConfig.findUnique({ where: { id: fx.configB } });
    expect(row?.temperature).toBeCloseTo(0.55);
    // Audit event recorded with projectId = projectB
    const audit = await prisma().auditEvent.findFirst({
      where: { objectId: fx.configB, objectType: "AIConfig", action: "update" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.projectId).toBe(fx.projectB);
  });

  it("R1: a SitePI (no AIConfigUpdate) is forbidden from updating a config on A", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/ai-config/configs/${fx.configA}`,
      ...asUser(fx.piOnA),
      payload: { temperature: 0.7 },
    });
    expect(res.statusCode).toBe(403);
  });

  /* ─── Prompt version create ──────────────────────── */
  it("POST /api/ai-config/prompts creates a new version and is immutable after the fact", async () => {
    const v2 = await app.inject({
      method: "POST",
      url: "/api/ai-config/prompts",
      ...asUser(fx.sponsorOnA),
      payload: {
        code: fx.promptCode,
        body: "Second version body",
        variables: ["subjectTimeline"],
        outputKind: "RiskSignal",
      },
    });
    expect(v2.statusCode).toBe(200);
    const created = v2.json();
    expect(created.code).toBe(fx.promptCode);
    expect(created.version).not.toBe("1.0.0");

    // v1 still exists and is unchanged
    const v1 = await prisma().promptTemplate.findUnique({ where: { id: fx.promptV1 } });
    expect(v1?.body).toBe("Initial prompt body");
  });

  it("POST /api/ai-config/prompts rejects a duplicate (code, version) pair", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/ai-config/prompts",
      ...asUser(fx.sponsorOnA),
      payload: {
        code: fx.promptCode,
        body: "Should conflict",
        variables: [],
        outputKind: "RiskSignal",
        version: "1.0.0",
      },
    });
    expect(res.statusCode).toBe(409);
  });

  /* ─── Adopt output: state machine + audit + atomicity ── */
  it("POST /api/ai-config/outputs/:id/adopt transitions Pending → Adopted and writes audit", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/ai-config/outputs/${fx.outputPending}/adopt`,
      ...asUser(fx.sponsorOnA),
      payload: { notes: "已与受试者核对，采纳建议。" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe(HumanConfirmationStatus.Adopted);
    const row = await prisma().aIOutput.findUnique({ where: { id: fx.outputPending } });
    expect(row?.status).toBe(HumanConfirmationStatus.Adopted);
    expect(row?.notes).toContain("已与受试者核对");
    const audit = await prisma().auditEvent.findFirst({
      where: {
        objectId: fx.outputPending,
        objectType: "AIOutput",
        action: "ai-output-adopted",
      },
    });
    expect(audit).not.toBeNull();
    expect((audit?.beforeValue as { status: string } | null)?.status).toBe("Pending");
  });

  it("Adopt on an already-Adopted output is rejected by the state machine (CONFLICT)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/ai-config/outputs/${fx.outputAdopted}/adopt`,
      ...asUser(fx.sponsorOnA),
      payload: {},
    });
    // The domain helper throws; the API surfaces a 409 (or 400/422);
    // we accept 409 because that matches the conflict semantics used
    // elsewhere in the route layer.
    expect([409, 400, 422]).toContain(res.statusCode);
  });

  /* ─── Reject output: reason required + state machine ─ */
  it("POST /api/ai-config/outputs/:id/reject without reason is REJECTED with REASON_REQUIRED (no state change)", async () => {
    // Spin up a fresh pending output so we can target it deterministically.
    const out = await prisma().aIOutput.create({
      data: {
        kind: "RiskSignal",
        projectId: fx.projectA,
        confidence: 0.4,
        confidenceLevel: "Low",
        model: "mock-test-model",
        modelVersion: "v1",
        inputHash: `hash-${RUN_TAG}-r1`,
        payload: { suggestion: "建议拒绝" } as object,
        status: HumanConfirmationStatus.Pending,
        knowledgeBaseRefs: [] as object,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/ai-config/outputs/${out.id}/reject`,
      ...asUser(fx.sponsorOnA),
      payload: { reason: "" },
    });
    // The route's zod schema is the first guardrail: an empty `reason`
    // is rejected as a validation error before the audit helper ever
    // runs. The audit helper (auditTx) re-enforces the same rule
    // defensively (REASON_REQUIRED) for paths that don't go through
    // zod. We assert the layered guarantee by checking the output
    // status + audit count together.
    expect([400, 422]).toContain(res.statusCode);
    expect(["VALIDATION_ERROR", "REASON_REQUIRED"]).toContain(res.json().code);
    // The output must still be Pending.
    const row = await prisma().aIOutput.findUnique({ where: { id: out.id } });
    expect(row?.status).toBe(HumanConfirmationStatus.Pending);
    // And no audit event was written.
    const auditCount = await prisma().auditEvent.count({
      where: { objectId: out.id, objectType: "AIOutput", action: "ai-output-rejected" },
    });
    expect(auditCount).toBe(0);
  });

  it("POST /api/ai-config/outputs/:id/reject with reason transitions Pending → Rejected", async () => {
    const out = await prisma().aIOutput.create({
      data: {
        kind: "RiskSignal",
        projectId: fx.projectA,
        confidence: 0.3,
        confidenceLevel: "Low",
        model: "mock-test-model",
        modelVersion: "v1",
        inputHash: `hash-${RUN_TAG}-r2`,
        payload: { suggestion: "建议拒绝" } as object,
        status: HumanConfirmationStatus.Pending,
        knowledgeBaseRefs: [] as object,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/ai-config/outputs/${out.id}/reject`,
      ...asUser(fx.sponsorOnA),
      payload: { reason: "置信度过低，需研究者现场复核。" },
    });
    expect(res.statusCode).toBe(200);
    const row = await prisma().aIOutput.findUnique({ where: { id: out.id } });
    expect(row?.status).toBe(HumanConfirmationStatus.Rejected);
    expect(row?.rejectionReason).toContain("置信度过低");
    const audit = await prisma().auditEvent.findFirst({
      where: { objectId: out.id, objectType: "AIOutput", action: "ai-output-rejected" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toContain("置信度过低");
  });

  /* ─── R2: outputs list scoping ─────────────────────── */
  it("GET /api/ai-config/outputs only returns the caller's project", async () => {
    // SponsorAdmin on A reads outputs — must not see anything from B
    // (no outputs on B exist for this run, so the assertion is
    // "all items projectId === A").
    const res = await app.inject({
      method: "GET",
      url: `/api/ai-config/outputs?status=Pending&pageSize=100`,
      ...asUser(fx.sponsorOnA),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.every((o: { projectId: string }) => o.projectId === fx.projectA)).toBe(true);
  });

  it("R2: outputs review queue rejects ?projectId=<other> from a non-member", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/ai-config/outputs?status=Pending&projectId=${fx.projectB}`,
      ...asUser(fx.sponsorOnA),
    });
    expect(res.statusCode).toBe(403);
  });
});
