/**
 * Assisted Entry minimum slice tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { disconnectPrisma, prisma } from "../db.js";
import {
  AssistedCollectionChannel,
  DataEntryChannel,
  QuestionnaireStatus,
  Role,
} from "@aic-dct/domain";

const RUN_TAG = `assisted-${Date.now()}`;

interface Fx {
  projectId: string;
  siteId: string;
  subjectId: string;
  templateId: string;
  crcUser: string;
  subjectUser: string;
}

async function setupFx(): Promise<Fx> {
  const project = await prisma().project.create({
    data: {
      code: `AE-${RUN_TAG}`,
      name: "AE",
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
  const subjectId = (
    await prisma().subject.create({
      data: {
        projectId: project.id,
        siteId: site.id,
        status: "Active",
        subjectCode: `SUB-${RUN_TAG}`,
      },
    })
  ).id;
  const templateId = (
    await prisma().questionnaireTemplate.create({
      data: {
        projectId: project.id,
        code: `T-${RUN_TAG}`,
        name: "Q",
        version: "1",
        schema: { sections: [{ id: "s1", title: "S", items: [{ id: "pain", type: "scale", prompt: "Pain" }] }] },
      },
    })
  ).id;
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
  const subjectUser = (
    await prisma().user.create({
      data: {
        email: `sub-${RUN_TAG}`,
        displayName: "Subject",
        organization: "T",
        roleAssignments: {
          create: [{ projectId: project.id, siteId: site.id, role: Role.Subject }],
        },
      },
    })
  ).id;
  await prisma().subject.update({
    where: { id: subjectId },
    data: { subjectUserId: subjectUser },
  });
  return { projectId: project.id, siteId: site.id, subjectId, templateId, crcUser, subjectUser };
}

async function cleanupFx(): Promise<void> {
  await prisma().auditEvent.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().assistedEntryCorrection.deleteMany({
    where: { assistedEntry: { project: { code: { contains: RUN_TAG } } } },
  });
  await prisma().assistedEntry.deleteMany({
    where: { project: { code: { contains: RUN_TAG } } },
  });
  await prisma().questionnaireResponse.deleteMany({
    where: { subject: { subjectCode: { contains: RUN_TAG } } },
  });
  await prisma().questionnaireTemplate.deleteMany({
    where: { code: { contains: RUN_TAG } },
  });
  await prisma().subject.deleteMany({ where: { subjectCode: { contains: RUN_TAG } } });
  await prisma().roleAssignment.deleteMany({
    where: { user: { email: { contains: RUN_TAG } } },
  });
  await prisma().user.deleteMany({ where: { email: { contains: RUN_TAG } } });
  await prisma().site.deleteMany({ where: { code: { contains: RUN_TAG } } });
  await prisma().project.deleteMany({ where: { code: { contains: RUN_TAG } } });
}

describe("Assisted Entry", () => {
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

  it("CRC cannot use staff ePRO create path", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/epro/responses",
      headers: { "x-actor-id": fx.crcUser },
      payload: {
        subjectId: fx.subjectId,
        questionnaireTemplateId: fx.templateId,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("assisted entry preserves AssistedEntry channel and metadata", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/api/epro/assisted-entries/start",
      headers: { "x-actor-id": fx.crcUser },
      payload: {
        subjectId: fx.subjectId,
        questionnaireTemplateId: fx.templateId,
        reason: "受试者电话口述，无法操作 App",
        collectionChannel: AssistedCollectionChannel.Phone,
      },
    });
    expect(start.statusCode).toBe(200);
    const started = start.json();
    expect(started.entryChannel).toBe(DataEntryChannel.AssistedEntry);

    const save = await app.inject({
      method: "PATCH",
      url: `/api/epro/assisted-entries/${started.assistedEntryId}/save`,
      headers: { "x-actor-id": fx.crcUser },
      payload: { responses: { pain: 3 } },
    });
    expect(save.statusCode).toBe(200);

    const submit = await app.inject({
      method: "POST",
      url: `/api/epro/assisted-entries/${started.assistedEntryId}/submit`,
      headers: { "x-actor-id": fx.crcUser },
      payload: {
        responses: { pain: 3 },
        reason: "CRC 代录确认提交",
      },
    });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().dataOrigin).toBe("AssistedEntry");

    const row = await prisma().questionnaireResponse.findUnique({
      where: { id: started.responseId },
    });
    expect(row?.entryChannel).toBe(DataEntryChannel.AssistedEntry);
    expect(row?.status).toBe(QuestionnaireStatus.Submitted);

    const meta = await prisma().assistedEntry.findUnique({
      where: { id: started.assistedEntryId },
    });
    expect(meta?.reason).toContain("电话");
    expect(meta?.collectionChannel).toBe(AssistedCollectionChannel.Phone);
  });

  it("assisted entry is never SubjectSelfReport", async () => {
    const detail = await app.inject({
      method: "GET",
      url: `/api/epro/responses/${(
        await prisma().questionnaireResponse.findFirst({
          where: { subjectId: fx.subjectId, entryChannel: DataEntryChannel.AssistedEntry },
        })
      )?.id}`,
      headers: { "x-actor-id": fx.crcUser },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.response.entryChannel).toBe(DataEntryChannel.AssistedEntry);
    expect(body.assistedEntry?.dataOrigin).toBe("AssistedEntry");
    expect(body.response.entryChannel).not.toBe(DataEntryChannel.SubjectSelfReport);
  });

  it("correction appends history with reason", async () => {
    const assisted = await prisma().assistedEntry.findFirst({
      where: { subjectId: fx.subjectId },
      include: { questionnaireResponse: true },
    });
    expect(assisted).toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: `/api/epro/assisted-entries/${assisted!.id}/corrections`,
      headers: { "x-actor-id": fx.crcUser },
      payload: {
        responses: { pain: 4 },
        reason: "受试者澄清评分为 4 而非 3",
      },
    });
    expect(res.statusCode).toBe(200);

    const corrections = await prisma().assistedEntryCorrection.findMany({
      where: { assistedEntryId: assisted!.id },
    });
    expect(corrections.length).toBe(1);
    expect(corrections[0].reason).toContain("澄清");
  });
});