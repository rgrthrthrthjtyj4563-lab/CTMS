/**
 * AIC-DCT Demo Study Seed (Phase 0)
 *
 * Inserts one demo study with:
 *   - 1 project, 2 sites
 *   - 6 users (SponsorAdmin, CROPM, SitePI, SiteCRC, CRA, Auditor)
 *   - 8 subjects (mix of statuses)
 *   - Visits, questionnaire responses
 *   - 1 confirmed AE, 1 possible SAE in draft
 *   - Drug shipment, sample transfer
 *   - 2 AI outputs (one pending, one adopted)
 *   - A small audit event trail
 *
 * Per architecture rules this seed is the canonical demo dataset; UI pages
 * must read from the API backed by this data, not from in-component mocks.
 *
 * Run via: `npm run db:seed` (apps/api workspace)
 */
import { PrismaClient, Role, SubjectStatus, VisitStatus, ConsentStatus, SafetyEventStatus, RiskLevel, RiskStatus, HumanConfirmationStatus, ReportStatus, ProtocolParseStatus, QuestionnaireStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding AIC-DCT demo study...");

  // Wipe in dependency order — Phase 0 demo only.
  await prisma.auditEvent.deleteMany();
  await prisma.aIOutput.deleteMany();
  await prisma.aICallLog.deleteMany();
  await prisma.promptTemplate.deleteMany();
  await prisma.aIConfig.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.exportRecord.deleteMany();
  await prisma.reportDraft.deleteMany();
  await prisma.sampleTransfer.deleteMany();
  await prisma.drugShipment.deleteMany();
  await prisma.riskHandlingRecord.deleteMany();
  await prisma.riskSignal.deleteMany();
  await prisma.safetyFollowUp.deleteMany();
  await prisma.symptomReport.deleteMany();
  await prisma.safetyEvent.deleteMany();
  await prisma.questionnaireResponse.deleteMany();
  await prisma.remoteVisitRecord.deleteMany();
  await prisma.visitTask.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.signatureRecord.deleteMany();
  await prisma.consentTask.deleteMany();
  await prisma.consentDocument.deleteMany();
  await prisma.aIProtocolParseResult.deleteMany();
  await prisma.protocolVersion.deleteMany();
  await prisma.subjectSensitiveIdentity.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();
  await prisma.questionnaireTemplate.deleteMany();
  await prisma.project.deleteMany();

  // ─── Project + Sites ──────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      code: "AUR-001",
      name: "AUR-001 复发难治B细胞淋巴瘤多中心II期",
      sponsor: "Acme Biotech",
      therapeuticArea: "Oncology",
      phase: "II",
      description: "Phase II multicenter study of AUR-001 in r/r B-cell lymphoma.",
      startDate: new Date("2024-01-15"),
      estimatedEndDate: new Date("2026-12-31"),
    },
  });

  const site1 = await prisma.site.create({
    data: {
      projectId: project.id,
      code: "PEK-001",
      name: "北京协和医院",
      city: "北京",
      region: "华北",
    },
  });
  const site2 = await prisma.site.create({
    data: {
      projectId: project.id,
      code: "SHA-002",
      name: "上海瑞金医院",
      city: "上海",
      region: "华东",
    },
  });

  // ─── Users ────────────────────────────────────────────────
  const sponsor = await prisma.user.create({
    data: { email: "sponsor@aic-dct.test", displayName: "赵明（赞助方）", organization: "Acme Biotech", roleAssignments: { create: [{ projectId: project.id, role: Role.SponsorAdmin }] } },
  });
  const croPm = await prisma.user.create({
    data: { email: "pm@aic-dct.test", displayName: "李娜（CRO PM）", organization: "CRO Partner", roleAssignments: { create: [{ projectId: project.id, role: Role.CROPM }] } },
  });
  const pi1 = await prisma.user.create({
    data: { email: "pi-pek@aic-dct.test", displayName: "陈强（PI 北京协和）", organization: "北京协和医院", roleAssignments: { create: [{ projectId: project.id, siteId: site1.id, role: Role.SitePI }] } },
  });
  const crc1 = await prisma.user.create({
    data: { email: "crc-pek@aic-dct.test", displayName: "张丽华（CRC 北京协和）", organization: "北京协和医院", roleAssignments: { create: [{ projectId: project.id, siteId: site1.id, role: Role.SiteCRC }] } },
  });
  const pi2 = await prisma.user.create({
    data: { email: "pi-sha@aic-dct.test", displayName: "陈静（PI 上海瑞金）", organization: "上海瑞金医院", roleAssignments: { create: [{ projectId: project.id, siteId: site2.id, role: Role.SitePI }] } },
  });
  const cra = await prisma.user.create({
    data: { email: "cra@aic-dct.test", displayName: "刘洋（CRA）", organization: "CRO Partner", roleAssignments: { create: [{ projectId: project.id, role: Role.CRA }] } },
  });
  const auditor = await prisma.user.create({
    data: { email: "auditor@aic-dct.test", displayName: "王芳（审计）", organization: "External Audit", roleAssignments: { create: [{ projectId: project.id, role: Role.Auditor }] } },
  });

  // Update site PI pointers
  await prisma.site.update({ where: { id: site1.id }, data: { principalInvestigatorUserId: pi1.id } });
  await prisma.site.update({ where: { id: site2.id }, data: { principalInvestigatorUserId: pi2.id } });

  // ─── Protocol Version ─────────────────────────────────────
  const protocol = await prisma.protocolVersion.create({
    data: {
      projectId: project.id,
      version: "v3.0",
      documentUrl: "https://files.example.test/protocols/AUR-001-v3.pdf",
      parseStatus: ProtocolParseStatus.Effective,
      effectiveFrom: new Date("2024-04-01"),
    },
  });

  // ─── Consent Document ─────────────────────────────────────
  const consentDoc = await prisma.consentDocument.create({
    data: {
      projectId: project.id,
      version: "ICF-v3.0",
      title: "AUR-001 II期临床试验知情同意书",
      documentUrl: "https://files.example.test/icf/AUR-001-ICF-v3.pdf",
      effectiveFrom: new Date("2024-04-01"),
    },
  });

  // ─── Questionnaire Template ──────────────────────────────
  const qolTemplate = await prisma.questionnaireTemplate.create({
    data: {
      projectId: project.id,
      code: "FACT-LYM",
      name: "FACT-LYM 生活质量量表",
      version: "v1",
      schema: {
        sections: [
          { code: "physical", items: 7 },
          { code: "social", items: 7 },
          { code: "emotional", items: 6 },
          { code: "functional", items: 7 },
        ],
      },
    },
  });

  // ─── Subjects (8) ─────────────────────────────────────────
  const subjectSeeds = [
    { code: "AUR-001-003", site: site1.id, status: SubjectStatus.Active, epro: 92, ae: 1, risk: RiskLevel.High, crcId: crc1.id, aiRisk: 78, name: "受试者A", sex: "Female", year: 1962 },
    { code: "AUR-001-011", site: site1.id, status: SubjectStatus.Screening, epro: 0, ae: 0, risk: RiskLevel.Medium, crcId: crc1.id, aiRisk: 45, name: "受试者B", sex: "Male", year: 1971 },
    { code: "AUR-002-007", site: site2.id, status: SubjectStatus.Active, epro: 88, ae: 2, risk: RiskLevel.Critical, crcId: pi2.id, aiRisk: 85, name: "受试者C", sex: "Male", year: 1958 },
    { code: "AUR-002-014", site: site2.id, status: SubjectStatus.Active, epro: 75, ae: 0, risk: RiskLevel.High, crcId: pi2.id, aiRisk: 62, name: "受试者D", sex: "Female", year: 1965 },
    { code: "AUR-003-002", site: site1.id, status: SubjectStatus.Completed, epro: 97, ae: 0, risk: RiskLevel.Low, crcId: crc1.id, aiRisk: 20, name: "受试者E", sex: "Male", year: 1955 },
    { code: "AUR-003-009", site: site1.id, status: SubjectStatus.Withdrawn, epro: 60, ae: 1, risk: RiskLevel.Critical, crcId: crc1.id, aiRisk: 92, name: "受试者F", sex: "Female", year: 1948 },
    { code: "AUR-001-018", site: site1.id, status: SubjectStatus.Consenting, epro: 0, ae: 0, risk: RiskLevel.Low, crcId: crc1.id, aiRisk: 30, name: "受试者G", sex: "Male", year: 1968 },
    { code: "AUR-002-021", site: site2.id, status: SubjectStatus.Active, epro: 83, ae: 0, risk: RiskLevel.Medium, crcId: pi2.id, aiRisk: 55, name: "受试者H", sex: "Female", year: 1960 },
  ];

  const subjects = [] as { id: string; code: string; siteId: string; status: SubjectStatus }[];
  for (const s of subjectSeeds) {
    const created = await prisma.subject.create({
      data: {
        projectId: project.id,
        siteId: s.site,
        status: s.status,
        subjectCode: s.code,
        initials: s.name.slice(-1),
        yearOfBirth: s.year,
        ageBand: `${2024 - s.year}岁`,
        sex: s.sex,
        city: s.site === site1.id ? "北京" : "上海",
        ownerUserId: s.crcId,
      },
    });
    await prisma.subjectSensitiveIdentity.create({
      data: {
        subjectId: created.id,
        fullName: `${s.name}（脱敏）`,
        nationalId: `110**********${s.code.slice(-3)}`,
        dateOfBirth: new Date(`${s.year}-06-15`),
        phone: "138********",
        email: `${s.code.toLowerCase()}@example.test`,
        address: "（脱敏）",
      },
    });
    subjects.push({ id: created.id, code: s.code, siteId: s.site, status: s.status });
  }

  // ─── Subject mobile identities (M4A) ─────────────────────
  const subjectUserA = await prisma.user.create({
    data: {
      email: "subject-a@aic-dct.test",
      displayName: "受试者 App A",
      phone: "139****0001",
      roleAssignments: {
        create: [{ projectId: project.id, siteId: site1.id, role: Role.Subject }],
      },
    },
  });
  const subjectUserB = await prisma.user.create({
    data: {
      email: "subject-b@aic-dct.test",
      displayName: "受试者 App B",
      phone: "139****0002",
      roleAssignments: {
        create: [{ projectId: project.id, siteId: site1.id, role: Role.Subject }],
      },
    },
  });
  await prisma.subject.update({
    where: { id: subjects[0].id },
    data: { subjectUserId: subjectUserA.id },
  });
  await prisma.subject.update({
    where: { id: subjects[1].id },
    data: { subjectUserId: subjectUserB.id },
  });

  // ─── Consent Tasks ────────────────────────────────────────
  for (const subj of subjects) {
    const status =
      subj.status === SubjectStatus.Consenting
        ? ConsentStatus.Reading
        : subj.status === SubjectStatus.Withdrawn
          ? ConsentStatus.Withdrawn
          : subj.status === SubjectStatus.Screening
            ? ConsentStatus.Completed
            : ConsentStatus.Completed;
    await prisma.consentTask.create({
      data: {
        subjectId: subj.id,
        consentDocumentId: consentDoc.id,
        status,
        startedAt: new Date("2024-04-10"),
        completedAt: status === ConsentStatus.Completed ? new Date("2024-04-12") : undefined,
        comprehensionScore: status === ConsentStatus.Completed ? 0.92 : undefined,
      },
    });
  }

  // ─── Visits ───────────────────────────────────────────────
  const visitSeeds = [
    { idx: 0, code: "V1", status: VisitStatus.Completed, offsetDays: -60 },
    { idx: 0, code: "V2", status: VisitStatus.Completed, offsetDays: -45 },
    { idx: 0, code: "V3", status: VisitStatus.SubmittedForPI, offsetDays: -15 },
    { idx: 0, code: "V4", status: VisitStatus.OutOfWindow, offsetDays: 5 },
    { idx: 2, code: "V4", status: VisitStatus.InProgress, offsetDays: 0 },
    { idx: 2, code: "V5", status: VisitStatus.Scheduled, offsetDays: 14 },
    { idx: 3, code: "V3", status: VisitStatus.Scheduled, offsetDays: 7 },
  ];
  for (const v of visitSeeds) {
    const subj = subjects[v.idx];
    const base = new Date();
    base.setDate(base.getDate() + v.offsetDays);
    await prisma.visit.create({
      data: {
        subjectId: subj.id,
        visitCode: v.code,
        scheduledAt: base,
        windowStart: new Date(base.getTime() - 7 * 86400e3),
        windowEnd: new Date(base.getTime() + 7 * 86400e3),
        status: v.status,
        createdByUserId: crc1.id,
      },
    });
  }

  // ─── Questionnaire Responses ─────────────────────────────
  // M4A: an open Subject-channel task for mobile demo (not seed/Web staff data).
  await prisma.questionnaireResponse.create({
    data: {
      questionnaireTemplateId: qolTemplate.id,
      subjectId: subjects[0].id,
      status: QuestionnaireStatus.Scheduled,
      entryChannel: "SubjectSelfReport",
      responses: {},
    },
  });

  for (const subj of subjects) {
    const s = subj.status;
    const status =
      s === SubjectStatus.Withdrawn
        ? QuestionnaireStatus.Missed
        : s === SubjectStatus.Screening || s === SubjectStatus.Consenting
          ? QuestionnaireStatus.Scheduled
          : QuestionnaireStatus.Submitted;
    await prisma.questionnaireResponse.create({
      data: {
        questionnaireTemplateId: qolTemplate.id,
        subjectId: subj.id,
        status,
        responses: { physical: 18, social: 22, emotional: 17, functional: 19 },
        submittedAt: status === QuestionnaireStatus.Submitted ? new Date() : null,
      },
    });
  }

  // ─── Safety events (1 confirmed AE + 1 SAE draft) ────────
  const aeSubject = subjects[0];
  const saeSubject = subjects[2];
  const ae = await prisma.safetyEvent.create({
    data: {
      subjectId: aeSubject.id,
      projectId: project.id,
      onsetAt: new Date(Date.now() - 12 * 86400e3),
      description: "受试者报告2级中性粒细胞减少，无发热。",
      severity: RiskLevel.Medium,
      status: SafetyEventStatus.ConfirmedAE,
      isSerious: false,
      createdByUserId: crc1.id,
    },
  });
  await prisma.safetyFollowUp.create({
    data: {
      safetyEventId: ae.id,
      followUpAt: new Date(),
      outcome: "复查后恢复至基线水平，继续原剂量。",
      recordedByUserId: pi1.id,
    },
  });

  const sae = await prisma.safetyEvent.create({
    data: {
      subjectId: saeSubject.id,
      projectId: project.id,
      onsetAt: new Date(Date.now() - 2 * 86400e3),
      description: "3级发热性中性粒细胞减少，需住院观察。",
      severity: RiskLevel.Critical,
      status: SafetyEventStatus.Draft,
      isSerious: true,
      aiSuggested: true,
      createdByUserId: pi2.id,
    },
  });

  // ─── Risk Signals ────────────────────────────────────────
  await prisma.riskSignal.createMany({
    data: [
      {
        projectId: project.id, level: RiskLevel.Critical, type: "AE未处理",
        objectType: "SafetyEvent", objectId: sae.id, subjectId: saeSubject.id,
        trigger: "SAE超24h未上报给IRB", suggestion: "立即通知研究者完成SAE上报。",
        ownerUserId: pi2.id, status: RiskStatus.Open,
      },
      {
        projectId: project.id, level: RiskLevel.High, type: "访视超窗",
        objectType: "Visit", objectId: subjects[0].id, subjectId: subjects[0].id,
        trigger: "V4访视超出时间窗±7天（已超14天）", suggestion: "安排补救访视或记录方案偏离。",
        ownerUserId: crc1.id, status: RiskStatus.InProgress,
      },
      {
        projectId: project.id, level: RiskLevel.Medium, type: "ePRO缺失",
        objectType: "Subject", objectId: subjects[5].id, subjectId: subjects[5].id,
        trigger: "连续3次ePRO未按时填写", suggestion: "CRC电话提醒。",
        ownerUserId: crc1.id, status: RiskStatus.Open,
      },
    ],
  });

  // ─── Drug / Sample ───────────────────────────────────────
  await prisma.drugShipment.create({
    data: {
      projectId: project.id,
      siteId: site2.id,
      subjectId: subjects[2].id,
      batchNumber: "AUR001-20240701",
      dispatchedAt: new Date(Date.now() - 5 * 86400e3),
      receivedAt: new Date(Date.now() - 3 * 86400e3),
      temperatureLog: [
        { at: new Date(Date.now() - 5 * 86400e3), temperatureC: 4.1, location: "上海仓库" },
        { at: new Date(Date.now() - 4 * 86400e3), temperatureC: 4.0, location: "在途" },
        { at: new Date(Date.now() - 3 * 86400e3), temperatureC: 3.9, location: "瑞金药房" },
      ],
    },
  });
  await prisma.sampleTransfer.create({
    data: {
      projectId: project.id, subjectId: subjects[0].id,
      sampleType: "血浆", status: "Collected",
      collectedAt: new Date(Date.now() - 10 * 86400e3),
    },
  });

  // ─── Report / Document ───────────────────────────────────
  await prisma.reportDraft.create({
    data: { projectId: project.id, type: "Interim", status: ReportStatus.Draft },
  });
  await prisma.document.create({
    data: { projectId: project.id, title: "研究者手册", category: "Manual" },
  });

  // ─── AI Platform + AI Outputs ───────────────────────────
  await prisma.aIConfig.create({
    data: { projectId: project.id, provider: "anthropic", model: "claude-3.5-sonnet", temperature: 0.2 },
  });
  const prompt = await prisma.promptTemplate.create({
    data: {
      code: "risk-signal-v1",
      version: "1.0.0",
      body: "Analyze the subject timeline and return suggested risk signals.",
      variables: ["subjectTimeline"],
      outputKind: "RiskSignal",
    },
  });

  const pendingOutput = await prisma.aIOutput.create({
    data: {
      kind: "RiskSignal",
      projectId: project.id,
      subjectId: subjects[2].id,
      payload: { suggestion: "建议安排V6访视", reason: "V5出现G3血液毒性" },
      confidence: 0.72,
      confidenceLevel: "Medium",
      status: HumanConfirmationStatus.Pending,
      promptTemplateId: prompt.id,
      model: "claude-3.5-sonnet",
      modelVersion: "2024-06-20",
      inputHash: "sha256:pending",
      knowledgeBaseRefs: ["kb/protocol-a"],
    },
  });
  const adoptedOutput = await prisma.aIOutput.create({
    data: {
      kind: "VisitSchedule",
      projectId: project.id,
      subjectId: subjects[3].id,
      payload: { suggestion: "为受试者发起再知情任务" },
      confidence: 0.91,
      confidenceLevel: "High",
      status: HumanConfirmationStatus.Adopted,
      promptTemplateId: prompt.id,
      model: "claude-3.5-sonnet",
      modelVersion: "2024-06-20",
      inputHash: "sha256:adopted",
      knowledgeBaseRefs: ["kb/protocol-a"],
      confirmedByUserId: pi2.id,
      confirmedAt: new Date(),
      notes: "AI建议合理，已采纳。",
    },
  });

  await prisma.aICallLog.create({
    data: {
      aiOutputId: pendingOutput.id,
      promptTemplateId: prompt.id,
      model: "claude-3.5-sonnet",
      inputHash: "sha256:pending",
      startedAt: new Date(),
      finishedAt: new Date(),
      statusCode: 200,
    },
  });

  // ─── Audit events ────────────────────────────────────────
  await prisma.auditEvent.createMany({
    data: [
      {
        actorUserId: pi1.id, actorRole: Role.SitePI, projectId: project.id,
        objectType: "SafetyEvent", objectId: ae.id, action: "confirm",
        afterValue: { status: "ConfirmedAE" }, requestId: "seed-1",
      },
      {
        actorUserId: pi2.id, actorRole: Role.SitePI, projectId: project.id,
        objectType: "AIOutput", objectId: adoptedOutput.id, action: "ai-output-adopted",
        afterValue: { status: "Adopted" }, reason: "建议合理", requestId: "seed-2",
      },
      {
        actorUserId: auditor.id, actorRole: Role.Auditor, projectId: project.id,
        objectType: "Subject", objectId: subjects[0].id, action: "view-full-identity",
        requestId: "seed-3",
      },
    ],
  });

  console.log("Seed complete.");
  console.log({
    project: project.code, sites: [site1.code, site2.code],
    users: [sponsor.email, croPm.email, pi1.email, crc1.email, pi2.email, cra.email, auditor.email, subjectUserA.email, subjectUserB.email],
    subjectMobileBindings: [
      { subject: subjects[0].code, user: subjectUserA.email },
      { subject: subjects[1].code, user: subjectUserB.email },
    ],
    subjects: subjects.length,
    ae: ae.id, sae: sae.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });