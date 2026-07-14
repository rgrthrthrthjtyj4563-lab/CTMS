/**
 * M4A — Subject source-data loop tests.
 *
 * Pins:
 *   - Subject identity binding (subjectUserId)
 *   - Self-only isolation (Subject A cannot read/write Subject B)
 *   - ePRO draft/submit preserves SubjectSelfReport entryChannel + audit
 *   - Severe symptom creates risk signal + safety draft
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import {
  DataEntryChannel,
  QuestionnaireStatus,
  Role,
  SymptomReportStatus,
} from "@aic-dct/domain";

const RUN_TAG = `m4a-${Date.now()}`;

interface Fx {
  projectId: string;
  siteId: string;
  templateId: string;
  subjectA: string;
  subjectB: string;
  subjectUserA: string;
  subjectUserB: string;
  crcUser: string;
  scheduledResponseA: string;
  visitA: string;
  visitB: string;
}

async function setupFx(): Promise<Fx> {
  const project = await prisma().project.create({
    data: {
      code: `M4A-${RUN_TAG}`,
      name: "M4A",
      sponsor: "T",
      therapeuticArea: "T",
      phase: "II",
      description: RUN_TAG,
      startDate: new Date(),
    },
  });
  const site = await prisma().site.create({
    data: { projectId: project.id, code: `S-${RUN_TAG}`, name: "S", city: "BJ" },
  });
  async function mkSubjectUser(email: string, subjectId: string) {
    const u = await prisma().user.create({
      data: {
        email: `${email}-${RUN_TAG}`,
        displayName: email,
        organization: "T",
        roleAssignments: {
          create: [{ projectId: project.id, siteId: site.id, role: Role.Subject }],
        },
      },
    });
    await prisma().subject.update({
      where: { id: subjectId },
      data: { subjectUserId: u.id },
    });
    return u.id;
  }
  const subjectA = (
    await prisma().subject.create({
      data: {
        projectId: project.id,
        siteId: site.id,
        status: "Active",
        subjectCode: `SA-${RUN_TAG}`,
      },
    })
  ).id;
  const subjectB = (
    await prisma().subject.create({
      data: {
        projectId: project.id,
        siteId: site.id,
        status: "Active",
        subjectCode: `SB-${RUN_TAG}`,
      },
    })
  ).id;
  const subjectUserA = await mkSubjectUser("subA", subjectA);
  const subjectUserB = await mkSubjectUser("subB", subjectB);
  const crcUser = (
    await prisma().user.create({
      data: {
        email: `crc-${RUN_TAG}`,
        displayName: "CRC",
        organization: "T",
        roleAssignments: {
          create: [{ projectId: project.id, siteId: site.id, role: Role.SiteCRC }],
        },
      },
    })
  ).id;
  const templateId = (
    await prisma().questionnaireTemplate.create({
      data: {
        projectId: project.id,
        code: `T-${RUN_TAG}`,
        name: "Pain",
        version: "1",
        schema: { sections: [{ id: "s1", title: "S", items: [{ id: "pain", type: "scale", prompt: "Pain" }] }] },
      },
    })
  ).id;
  const scheduledResponseA = (
    await prisma().questionnaireResponse.create({
      data: {
        subjectId: subjectA,
        questionnaireTemplateId: templateId,
        status: QuestionnaireStatus.Scheduled,
        entryChannel: DataEntryChannel.SubjectSelfReport,
        responses: {},
      },
    })
  ).id;
  const now = Date.now();
  const visitA = (
    await prisma().visit.create({
      data: {
        subjectId: subjectA,
        visitCode: "V1",
        status: "Scheduled",
        scheduledAt: new Date(now + 86400000),
        windowStart: new Date(now),
        windowEnd: new Date(now + 86400000 * 7),
      },
    })
  ).id;
  const visitB = (
    await prisma().visit.create({
      data: {
        subjectId: subjectB,
        visitCode: "V1",
        status: "Scheduled",
        scheduledAt: new Date(now + 86400000),
        windowStart: new Date(now),
        windowEnd: new Date(now + 86400000 * 7),
      },
    })
  ).id;
  return {
    projectId: project.id,
    siteId: site.id,
    templateId,
    subjectA,
    subjectB,
    subjectUserA,
    subjectUserB,
    crcUser,
    scheduledResponseA,
    visitA,
    visitB,
  };
}

async function cleanupFx(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().symptomReport.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().riskSignal.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().safetyEvent.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().visit.deleteMany({
    where: { subject: { subjectCode: { contains: RUN_TAG } } },
  });
  await prisma().questionnaireResponse.deleteMany({
    where: { subject: { subjectCode: { contains: RUN_TAG } } },
  });
  await prisma().questionnaireTemplate.deleteMany({
    where: { code: { contains: RUN_TAG } },
  });
  await prisma().subject.deleteMany({
    where: { subjectCode: { contains: RUN_TAG } },
  });
  await prisma().roleAssignment.deleteMany({
    where: { user: { email: { contains: RUN_TAG } } },
  });
  await prisma().user.deleteMany({ where: { email: { contains: RUN_TAG } } });
  await prisma().site.deleteMany({ where: { code: { contains: RUN_TAG } } });
  await prisma().project.deleteMany({ where: { code: { contains: RUN_TAG } } });
}

describe("M4A subject portal", () => {
  let app: FastifyInstance;
  let fx: Fx;

  beforeAll(async () => {
    fx = await setupFx();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await cleanupFx();
    await disconnectPrisma();
  });

  it("Subject A cannot read Subject B ePRO response", async () => {
    const respB = await prisma().questionnaireResponse.create({
      data: {
        subjectId: fx.subjectB,
        questionnaireTemplateId: fx.templateId,
        status: QuestionnaireStatus.InProgress,
        entryChannel: DataEntryChannel.SubjectSelfReport,
        responses: { pain: 3 },
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/subject/epro/responses/${respB.id}`,
      headers: { "x-actor-id": fx.subjectUserA },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Subject A cannot submit ePRO for Subject B via staff route", async () => {
    const respB = await prisma().questionnaireResponse.create({
      data: {
        subjectId: fx.subjectB,
        questionnaireTemplateId: fx.templateId,
        status: QuestionnaireStatus.InProgress,
        responses: { pain: 2 },
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/epro/responses/${respB.id}/submit`,
      headers: { "x-actor-id": fx.subjectUserA },
      payload: { responses: { pain: 9 } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Subject ePRO submit preserves SubjectSelfReport origin + audit", async () => {
    const save = await app.inject({
      method: "PATCH",
      url: `/api/subject/epro/responses/${fx.scheduledResponseA}`,
      headers: { "x-actor-id": fx.subjectUserA },
      payload: { responses: { pain: 4 } },
    });
    expect(save.statusCode).toBe(200);

    const submit = await app.inject({
      method: "POST",
      url: `/api/subject/epro/responses/${fx.scheduledResponseA}/submit`,
      headers: { "x-actor-id": fx.subjectUserA },
      payload: { responses: { pain: 4 } },
    });
    expect(submit.statusCode).toBe(200);
    const body = submit.json();
    expect(body.status).toBe(QuestionnaireStatus.Submitted);
    expect(body.entryChannel).toBe(DataEntryChannel.SubjectSelfReport);

    const row = await prisma().questionnaireResponse.findUnique({
      where: { id: fx.scheduledResponseA },
    });
    expect(row?.entryChannel).toBe(DataEntryChannel.SubjectSelfReport);
    expect(row?.submittedByUserId).toBe(fx.subjectUserA);

    const audits = await prisma().auditEvent.findMany({
      where: { objectId: fx.scheduledResponseA, action: "epro.response.submit" },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect((audits[0].afterValue as { dataOrigin?: string })?.dataOrigin).toBe(
      "SubjectSelfReport",
    );
  });

  it("severe symptom report creates risk signal visible to CRC", async () => {
    const report = await app.inject({
      method: "POST",
      url: "/api/subject/symptom-reports",
      headers: { "x-actor-id": fx.subjectUserA },
      payload: {
        discomfortType: "发热",
        onsetAt: new Date().toISOString(),
        severity: "Critical",
        hospitalized: true,
        description: "昨晚开始高热39.5℃",
      },
    });
    expect(report.statusCode).toBe(200);
    const body = report.json();
    expect(body.severe).toBe(true);
    expect(body.riskSignalId).toBeTruthy();
    expect(body.urgentCareGuidance).toContain("紧急");

    const risks = await app.inject({
      method: "GET",
      url: `/api/risks?projectId=${fx.projectId}`,
      headers: { "x-actor-id": fx.crcUser },
    });
    expect(risks.statusCode).toBe(200);
    const items = risks.json().items as Array<{ objectType: string; objectId: string }>;
    expect(items.some((r) => r.objectType === "SymptomReport" && r.objectId === body.id)).toBe(
      true,
    );

    const stored = await prisma().symptomReport.findUnique({ where: { id: body.id } });
    expect(stored?.status).toBe(SymptomReportStatus.Submitted);
    expect(stored?.entryChannel).toBe(DataEntryChannel.SubjectSelfReport);
  });

  it("non-Subject role cannot call /api/subject/me", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/subject/me",
      headers: { "x-actor-id": fx.crcUser },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
  });

  it("medium symptom without severe flags does not create risk signal", async () => {
    const report = await app.inject({
      method: "POST",
      url: "/api/subject/symptom-reports",
      headers: { "x-actor-id": fx.subjectUserA },
      payload: {
        discomfortType: "轻度头痛",
        onsetAt: new Date().toISOString(),
        severity: "Medium",
        description: "可耐受，未就医",
      },
    });
    expect(report.statusCode).toBe(200);
    const body = report.json();
    expect(body.severe).toBe(false);
    expect(body.riskSignalId).toBeNull();
    expect(body.safetyEventId).toBeNull();
  });

  it("CRC cannot submit Subject-original ePRO via staff route", async () => {
    const inProgress = await prisma().questionnaireResponse.create({
      data: {
        subjectId: fx.subjectA,
        questionnaireTemplateId: fx.templateId,
        status: QuestionnaireStatus.InProgress,
        entryChannel: DataEntryChannel.SubjectSelfReport,
        responses: { pain: 6 },
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/epro/responses/${inProgress.id}/submit`,
      headers: { "x-actor-id": fx.crcUser },
      payload: { responses: { pain: 6 } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Subject cannot attach another subject visit when starting ePRO", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/subject/epro/responses",
      headers: { "x-actor-id": fx.subjectUserA },
      payload: {
        questionnaireTemplateId: fx.templateId,
        visitId: fx.visitB,
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("CRC cannot PATCH Subject-original ePRO payload", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/epro/responses/${fx.scheduledResponseA}`,
      headers: { "x-actor-id": fx.crcUser },
      payload: { responses: { pain: 1 } },
    });
    expect(res.statusCode).toBe(403);
  });

  it("my-tasks returns only bound subject tasks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/subject/my-tasks",
      headers: { "x-actor-id": fx.subjectUserA },
    });
    expect(res.statusCode).toBe(200);
    const grouped = res.json().grouped as Record<string, Array<{ id: string }>>;
    const ids = [
      ...grouped.overdue,
      ...grouped.today,
      ...grouped.upcoming,
      ...grouped.completed,
    ].map((t) => t.id);
    expect(ids).toContain(fx.scheduledResponseA);
    const resB = await prisma().questionnaireResponse.findMany({
      where: { subjectId: fx.subjectB },
    });
    for (const r of resB) {
      expect(ids).not.toContain(r.id);
    }
  });
});