import type { ActionItemPayload, GeneratedActionPack } from '@clinical/domain';
import { prisma } from '../db.js';
import { generateActionPack, type AiContext } from './ai.js';
import { logAudit } from './audit.js';

export type { ActionItemPayload };

export async function buildAiContext(visitId: string): Promise<AiContext | null> {
  const visit = await prisma.monitoringVisit.findUnique({
    where: { id: visitId },
    include: {
      project: true,
      site: true,
      inputs: {
        where: { isVoided: false },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  });

  if (!visit) return null;

  const openIssues = await prisma.issue.findMany({
    where: {
      projectId: visit.projectId,
      siteId: visit.siteId,
      status: { in: ['OPEN', 'IN_PROGRESS', 'CRA_CONFIRMED'] },
    },
    select: { title: true, status: true },
  });

  return {
    projectId: visit.projectId,
    projectName: visit.project.name,
    projectCode: visit.project.code,
    siteId: visit.siteId,
    siteName: visit.site.name,
    visitId: visit.id,
    visitType: visit.type as AiContext['visitType'],
    visitDate: visit.plannedDate.toISOString().split('T')[0],
    inputs: visit.inputs.map((i) => ({ id: i.id, type: i.type, content: i.content })),
    attachments: visit.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
    })),
    openIssues,
  };
}

const ACTIVE_PACK_STATUSES = [
  'DRAFT',
  'GENERATING',
  'PENDING_CONFIRM',
  'PARTIALLY_CONFIRMED',
  'CONFIRMED',
  'SUBMITTED',
];

function buildItemSources(
  action: ActionItemPayload,
  ctx: AiContext,
): Array<{ kind: string; id: string; excerpt: string; field?: string }> {
  if (action.sources?.length) {
    return action.sources.map((s) => ({
      kind: s.attachmentId ? 'ATTACHMENT' : 'INPUT',
      id: (s.attachmentId || s.inputId || '') as string,
      excerpt: s.excerpt,
      field: s.field,
    }));
  }

  const sources: Array<{ kind: string; id: string; excerpt: string; field?: string }> = [];
  for (const id of action.sourceInputIds || []) {
    const input = ctx.inputs.find((i) => i.id === id);
    sources.push({
      kind: 'INPUT',
      id,
      excerpt: input ? input.content.slice(0, 160) : '（来源输入）',
    });
  }
  for (const id of action.sourceAttachmentIds || []) {
    const att = ctx.attachments.find((a) => a.id === id);
    sources.push({
      kind: 'ATTACHMENT',
      id,
      excerpt: att ? `附件：${att.fileName}` : '（来源附件）',
    });
  }
  if (sources.length === 0) {
    sources.push({
      kind: 'INPUT',
      id: '',
      excerpt: '规则推断或人工补充（无直接原文摘录）',
    });
  }
  return sources;
}

export async function createActionPackFromAi(
  visitId: string,
  userId: string,
): Promise<{ packId: string; generated: GeneratedActionPack | null; idempotent: boolean }> {
  const existing = await prisma.actionPack.findFirst({
    where: {
      monitoringVisitId: visitId,
      isActive: true,
      status: { in: ACTIVE_PACK_STATUSES },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await logAudit({
      type: 'AI_GENERATED_IDEMPOTENT',
      userId,
      entityType: 'ActionPack',
      entityId: existing.id,
      payload: { visitId, reason: 'active_pack_exists' },
    });
    return { packId: existing.id, generated: null, idempotent: true };
  }

  const ctx = await buildAiContext(visitId);
  if (!ctx) throw new Error('访视不存在');

  const generated = await generateActionPack(ctx);
  const originDefault = process.env.TEXT_LLM_API_KEY || process.env.XAI_API_KEY ? 'MODEL' : 'RULE';

  const pack = await prisma.actionPack.create({
    data: {
      monitoringVisitId: visitId,
      userId,
      status: 'PENDING_CONFIRM',
      isActive: true,
      summary: JSON.stringify(generated.summary),
      warnings: generated.warnings ? JSON.stringify(generated.warnings) : null,
      followUpQuestions: generated.followUpQuestions
        ? JSON.stringify(generated.followUpQuestions)
        : null,
      modelInfo: JSON.stringify({
        origin: originDefault,
        model: process.env.TEXT_LLM_MODEL || process.env.XAI_MODEL || 'rules',
        generatedAt: new Date().toISOString(),
      }),
      items: {
        create: generated.actions.map((action) => {
          const origin = action.origin ?? originDefault;
          const sources = buildItemSources(action, ctx);
          return {
            type: action.type,
            title: action.title,
            description: action.description,
            data: JSON.stringify(action.data),
            status: 'PENDING_CONFIRM',
            origin,
            sourceIds: JSON.stringify({
              inputIds: action.sourceInputIds || [],
              attachmentIds: action.sourceAttachmentIds || [],
              origin,
              sources,
            }),
            requiresIndividualConfirm: action.requiresIndividualConfirm ?? false,
            blockingReason: action.blockingReason,
          };
        }),
      },
    },
    include: { items: true },
  });

  await logAudit({
    type: 'AI_GENERATED',
    userId,
    entityType: 'ActionPack',
    entityId: pack.id,
    payload: {
      actionCount: generated.actions.length,
      visitId,
      origin: originDefault,
    },
  });

  return { packId: pack.id, generated, idempotent: false };
}

/** End visit + ensure single action pack (idempotent) */
export async function completeVisit(
  visitId: string,
  userId: string,
  actualEndTime?: string,
): Promise<{
  visit: { id: string; status: string; actualStartTime: Date | null; actualEndTime: Date | null };
  actionPackId: string;
  idempotent: boolean;
}> {
  const visit = await prisma.monitoringVisit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error('访视不存在');

  const endable = ['IN_PROGRESS', 'PENDING_WRAP_UP'];
  const alreadyPast = [
    'PENDING_CRA_CONFIRM',
    'PENDING_PM_REVIEW',
    'PM_RETURNED',
    'PENDING_QA_REVIEW',
    'APPROVED',
  ];

  if (visit.status === 'PLANNED') {
    throw new Error('访视尚未开始，无法结束');
  }
  if (visit.status === 'CANCELLED') {
    throw new Error('访视已取消');
  }
  if (!endable.includes(visit.status) && !alreadyPast.includes(visit.status)) {
    // still try to return pack if any
  }

  let statusChanged = false;
  let updated = visit;

  if (visit.status === 'IN_PROGRESS') {
    const endTime = actualEndTime ? new Date(actualEndTime) : new Date();
    updated = await prisma.monitoringVisit.update({
      where: { id: visitId },
      data: {
        status: 'PENDING_WRAP_UP',
        actualEndTime: endTime,
      },
    });
    statusChanged = true;
    await logAudit({
      type: 'VISIT_ENDED',
      userId,
      entityType: 'MonitoringVisit',
      entityId: visitId,
      payload: { actualEndTime: endTime.toISOString() },
    });
  } else if (visit.status === 'PENDING_WRAP_UP' || alreadyPast.includes(visit.status)) {
    // idempotent path — keep existing end time
    await logAudit({
      type: 'VISIT_ENDED_IDEMPOTENT',
      userId,
      entityType: 'MonitoringVisit',
      entityId: visitId,
      payload: { status: visit.status },
    });
  }

  const packResult = await createActionPackFromAi(visitId, userId);

  return {
    visit: {
      id: updated.id,
      status: updated.status === 'IN_PROGRESS' ? 'PENDING_WRAP_UP' : updated.status,
      actualStartTime: updated.actualStartTime,
      actualEndTime: updated.actualEndTime,
    },
    actionPackId: packResult.packId,
    idempotent: !statusChanged && packResult.idempotent,
  };
}

export const DEFAULT_IMV_ACTIVITIES: Array<{ activityType: string; title: string }> = [
  { activityType: 'SOURCE_DATA_REVIEW', title: '核对受试者原始记录' },
  { activityType: 'DRUG_ACCOUNTABILITY', title: '检查药物管理文件' },
  { activityType: 'INFORMED_CONSENT', title: '确认知情同意文件完整性' },
  { activityType: 'OPEN_ISSUE_FOLLOWUP', title: '跟进历史未关闭 Issue' },
  { activityType: 'SITE_COMMUNICATION', title: '与 CRC/PI 沟通发现' },
  { activityType: 'EVIDENCE_CAPTURE', title: '现场照片/证据采集' },
];

export async function ensureVisitActivities(visitId: string, visitType: string) {
  const count = await prisma.visitActivity.count({ where: { monitoringVisitId: visitId } });
  if (count > 0) return;

  const templates =
    visitType === 'SIV'
      ? [
          { activityType: 'SITE_READINESS', title: '中心启动准备核查' },
          { activityType: 'TRAINING', title: '中心培训记录确认' },
          ...DEFAULT_IMV_ACTIVITIES.slice(0, 4),
        ]
      : DEFAULT_IMV_ACTIVITIES;

  await prisma.visitActivity.createMany({
    data: templates.map((t, i) => ({
      monitoringVisitId: visitId,
      activityType: t.activityType,
      title: t.title,
      status: 'PENDING',
      sortOrder: i,
    })),
  });
}

/** Parse LLM/user date strings; invalid values (e.g. "补齐") become undefined. */
function parseOptionalDate(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export async function confirmActionItem(
  itemId: string,
  userId: string,
  editedData?: Record<string, unknown>,
): Promise<{ entityId?: string; type: string }> {
  const item = await prisma.actionItem.findUnique({
    where: { id: itemId },
    include: {
      actionPack: {
        include: {
          monitoringVisit: { include: { project: true, site: true } },
        },
      },
    },
  });

  if (!item) throw new Error('动作项不存在');

  const data = editedData ?? (JSON.parse(item.data) as Record<string, unknown>);
  const visit = item.actionPack.monitoringVisit;
  let savedEntityId: string | undefined;
  const fallbackFields: string[] = [];

  switch (item.type) {
    case 'MONITORING_VISIT_RECORD': {
      const personnel = data.sitePersonnel as string[] | undefined;
      const findings = data.findings as string[] | undefined;
      // Defensive: skip invalid datetime strings so Prisma never sees Invalid Date.
      const actualStartTime = parseOptionalDate(data.actualStartTime);
      const actualEndTime = parseOptionalDate(data.actualEndTime);
      if (data.actualStartTime && !actualStartTime) fallbackFields.push('actualStartTime');
      if (data.actualEndTime && !actualEndTime) fallbackFields.push('actualEndTime');
      await prisma.monitoringVisit.update({
        where: { id: visit.id },
        data: {
          actualStartTime,
          actualEndTime,
          subjectsReviewed: data.subjectsReviewed as number | undefined,
          workSummary: data.workSummary as string,
          sitePersonnel: personnel ? JSON.stringify(personnel) : undefined,
          findings: findings ? JSON.stringify(findings) : undefined,
          status: 'PENDING_CRA_CONFIRM',
        },
      });
      savedEntityId = visit.id;
      break;
    }
    case 'HOURS': {
      // 兜底：rules 路径生成的 data 可能缺 workType/durationHours
      let inferredDuration: number = 0;
      if (typeof data.durationHours === 'number') inferredDuration = data.durationHours as number;
      else if (typeof data.totalMinutes === 'number') inferredDuration = (data.totalMinutes as number) / 60;
      else if (typeof data.hours === 'number') inferredDuration = data.hours as number;
      else if (data.startTime && data.endTime) {
        const s = (data.startTime as string).split(':').map(Number);
        const e = (data.endTime as string).split(':').map(Number);
        const minutes = (e[0] * 60 + (e[1] || 0)) - (s[0] * 60 + (s[1] || 0));
        if (minutes > 0) inferredDuration = minutes / 60;
      } else if (data.start && data.end) {
        const s = (data.start as string).split(':').map(Number);
        const e = (data.end as string).split(':').map(Number);
        const minutes = (e[0] * 60 + (e[1] || 0)) - (s[0] * 60 + (s[1] || 0));
        if (minutes > 0) inferredDuration = minutes / 60;
      }
      // Defensive: invalid/missing date → actualStart → actualEnd → plannedDate.
      const parsedDate = parseOptionalDate(data.date);
      const hoursDate =
        parsedDate ?? visit.actualStartTime ?? visit.actualEndTime ?? visit.plannedDate;
      if (!parsedDate) fallbackFields.push('date');
      const hours = await prisma.hoursRecord.create({
        data: {
          userId,
          projectId: (data.projectId as string) || visit.projectId,
          siteId: (data.siteId as string) || visit.siteId,
          monitoringVisitId: visit.id,
          date: hoursDate,
          workType: (data.workType as string) || 'ON_SITE_MONITORING',
          startTime: (data.startTime as string) ?? (data.start as string | undefined),
          endTime: (data.endTime as string) ?? (data.end as string | undefined),
          durationHours: inferredDuration,
          description: (data.description as string) || 'IMV 现场监查',
          status: 'CRA_CONFIRMED',
        },
      });
      savedEntityId = hours.id;
      break;
    }
    case 'ISSUE': {
      // 兜底：LLM 可能没把 title/severity 写入 data，且 severity 可能是 Major/Minor/Critical 等自然语言
      const severityMap: Record<string, string> = {
        Major: 'HIGH', HIGH: 'HIGH', Critical: 'CRITICAL', CRITICAL: 'CRITICAL',
        Moderate: 'MEDIUM', MEDIUM: 'MEDIUM', Minor: 'LOW', LOW: 'LOW',
      };
      // Defensive: invalid targetDate (e.g. Chinese text) must not block confirm.
      const targetDate = parseOptionalDate(data.targetDate);
      if (data.targetDate && !targetDate) fallbackFields.push('targetDate');
      const issueTitle = (data.title as string) || item.title;
      const issue = await prisma.issue.create({
        data: {
          projectId: (data.projectId as string) || visit.projectId,
          siteId: (data.siteId as string) || visit.siteId,
          monitoringVisitId: visit.id,
          reporterId: userId,
          title: issueTitle,
          description: (data.description as string) || item.description || item.title,
          category: (data.category as string) || 'OTHER',
          severity: severityMap[(data.severity as string) || ''] || 'MEDIUM',
          subjectId: data.subjectId as string | undefined,
          responsiblePerson: data.responsiblePerson as string | undefined,
          targetDate,
          requiredEvidence: data.requiredEvidence as string | undefined,
          status: 'CRA_CONFIRMED',
        },
      });
      savedEntityId = issue.id;

      // Only create follow-up todo when we have a valid deadline (not garbage strings).
      if (data.responsiblePerson && targetDate) {
        await prisma.todo.create({
          data: {
            userId,
            title: `跟进: ${issueTitle}`,
            description: data.description as string,
            group: 'WAITING_OTHERS',
            dueDate: targetDate,
            sourceType: 'ISSUE',
            sourceId: issue.id,
            projectId: visit.projectId,
            siteId: visit.siteId,
            monitoringVisitId: visit.id,
            issueId: issue.id,
          },
        });
      }
      break;
    }
    case 'TASK': {
      // Defensive: invalid dueDate (e.g. "补齐") → undefined (DB allows null).
      // Does not block confirm; UI may show empty due label.
      const dueDate = parseOptionalDate(data.dueDate);
      if (data.dueDate && !dueDate) fallbackFields.push('dueDate');
      const todo = await prisma.todo.create({
        data: {
          userId,
          title: (data.title as string) || item.title,
          description: (data.description as string) ?? (data.instructions as string | undefined) ?? item.description ?? undefined,
          group: dueDate && dueDate <= new Date() ? 'DUE_TODAY' : 'NOW',
          dueDate,
          sourceType: 'TASK',
          // Source the task todo to its action pack so the todo can navigate into
          // the matching action item in the pack (TASK todos don't have a separate
          // detail page in V1; the action pack is the closest meaningful target).
          sourceId: item.actionPackId,
          projectId: visit.projectId,
          siteId: visit.siteId,
          monitoringVisitId: visit.id,
        },
      });
      savedEntityId = todo.id;
      break;
    }
    case 'EVIDENCE': {
      const attachmentId = data.attachmentId as string;
      if (attachmentId) {
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            fileType: data.fileType as string | undefined,
            confirmed: true,
            sensitiveFlag: (data.sensitiveInfoDetected as boolean) ?? false,
          },
        });
        savedEntityId = attachmentId;
      }
      break;
    }
    case 'REPORT_DRAFT': {
      // Defensive: AI may not always emit title/sections in expected shape.
      // Fall back to a visit-derived title and a single placeholder section so
      // confirm never throws and the report draft can be repaired later.
      const sections = Array.isArray(data.sections)
        ? (data.sections as Array<Record<string, unknown>>)
        : [];
      const title =
        (typeof data.title === 'string' && (data.title as string).trim()) ||
        item.title ||
        `${visit.type} 监查报告草稿`;
      if (!(typeof data.title === 'string' && (data.title as string).trim())) {
        fallbackFields.push('title');
      }
      if (sections.length === 0) fallbackFields.push('sections');
      const safeSections =
        sections.length > 0
          ? sections
          : [
              {
                sectionKey: 'summary',
                title: '访视摘要',
                content: (data.description as string) || item.description || '（待补全）',
                status: 'DRAFT',
              },
            ];
      await prisma.reportDraft.upsert({
        where: { monitoringVisitId: visit.id },
        create: {
          monitoringVisitId: visit.id,
          title,
          sections: JSON.stringify(safeSections),
          status: 'DRAFT',
        },
        update: {
          title,
          sections: JSON.stringify(safeSections),
        },
      });
      savedEntityId = visit.id;
      break;
    }
    case 'FOLLOW_UP_ITEM': {
      // Defensive: invalid/missing dueDate → today + 7 days placeholder.
      const parsedFollowUpDue = parseOptionalDate(data.dueDate);
      const followUpDue = parsedFollowUpDue ?? new Date(Date.now() + 7 * 86400000);
      if (!parsedFollowUpDue) fallbackFields.push('dueDate');
      if (!(data.item as string | undefined)) fallbackFields.push('item');
      if (!(data.responsiblePerson as string | undefined)) fallbackFields.push('responsiblePerson');
      const followUp = await prisma.followUpItem.create({
        data: {
          monitoringVisitId: visit.id,
          item: (data.item as string) || item.title,
          responsiblePerson: (data.responsiblePerson as string) || '（待指定）',
          dueDate: followUpDue,
          requiredEvidence: data.requiredEvidence as string | undefined,
          relatedIssueTitle: data.relatedIssueTitle as string | undefined,
          suggestedWording: data.suggestedWording as string | undefined,
          status: 'DRAFT',
        },
      });
      savedEntityId = followUp.id;
      break;
    }
    case 'RISK_CANDIDATE':
    case 'CAPA_CANDIDATE':
      // Candidates are acknowledged but not persisted as formal records in V1
      savedEntityId = item.id;
      break;
  }

  await prisma.actionItem.update({
    where: { id: itemId },
    data: {
      status: 'CONFIRMED',
      data: JSON.stringify(data),
      confirmedAt: new Date(),
      savedEntityId,
    },
  });

  await logAudit({
    type: fallbackFields.length > 0 ? 'ACTION_CONFIRMED_FALLBACK' : 'ACTION_CONFIRMED',
    userId,
    entityType: 'ActionItem',
    entityId: itemId,
    payload: {
      type: item.type,
      savedEntityId,
      ...(fallbackFields.length > 0 ? { fallbackFields } : {}),
    },
  });

  return { entityId: savedEntityId, type: item.type };
}

export async function confirmAllEligibleItems(
  packId: string,
  userId: string,
): Promise<{ confirmed: number; skipped: number }> {
  const items = await prisma.actionItem.findMany({
    where: {
      actionPackId: packId,
      status: { in: ['SUGGESTED', 'PENDING_CONFIRM', 'EDITED'] },
      requiresIndividualConfirm: false,
    },
  });

  let confirmed = 0;
  for (const item of items) {
    await confirmActionItem(item.id, userId);
    confirmed++;
  }

  const skipped = await prisma.actionItem.count({
    where: {
      actionPackId: packId,
      status: { in: ['SUGGESTED', 'PENDING_CONFIRM', 'EDITED'] },
    },
  });

  return { confirmed, skipped };
}

export async function submitActionPack(packId: string, userId: string) {
  const pack = await prisma.actionPack.findUnique({
    where: { id: packId },
    include: { items: true, monitoringVisit: true },
  });

  if (!pack) throw new Error('动作包不存在');

  const blocking = pack.items.filter((i) => i.blockingReason && i.status !== 'CONFIRMED');

  if (blocking.length > 0) {
    throw new Error(`存在阻塞项: ${blocking.map((b) => b.title).join(', ')}`);
  }

  // Confirm remaining non-risk items or check they're optional
  const requiredTypes = ['MONITORING_VISIT_RECORD', 'HOURS'];
  for (const reqType of requiredTypes) {
    const reqItem = pack.items.find((i) => i.type === reqType);
    if (reqItem && !['CONFIRMED', 'SAVED'].includes(reqItem.status)) {
      throw new Error(`${reqType} 尚未确认，无法提交`);
    }
  }

  if (!pack.monitoringVisit.actualEndTime) {
    throw new Error('访视结束时间未确认，无法提交');
  }

  await prisma.actionPack.update({
    where: { id: packId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  await prisma.monitoringVisit.update({
    where: { id: pack.monitoringVisitId },
    data: { status: 'PENDING_PM_REVIEW' },
  });

  // Create PM review todo
  const pmAssignment = await prisma.userAssignment.findFirst({
    where: { projectId: pack.monitoringVisit.projectId, role: 'PM' },
  });

  if (pmAssignment) {
    await prisma.todo.create({
      data: {
        userId: pmAssignment.userId,
        title: `审核 IMV 工作包`,
        description: `${pack.monitoringVisitId} 待 PM 审核`,
        group: 'PENDING_MY_REVIEW',
        sourceType: 'ACTION_PACK',
        sourceId: packId,
        monitoringVisitId: pack.monitoringVisitId,
        projectId: pack.monitoringVisit.projectId,
        siteId: pack.monitoringVisit.siteId,
      },
    });
  }

  await logAudit({
    type: 'PACK_SUBMITTED',
    userId,
    entityType: 'ActionPack',
    entityId: packId,
  });

  return pack;
}

export function countActionTypes(actions: ActionItemPayload[]) {
  return {
    monitoringVisit: actions.filter((a) => a.type === 'MONITORING_VISIT_RECORD').length,
    hours: actions.filter((a) => a.type === 'HOURS').length,
    issues: actions.filter((a) => a.type === 'ISSUE').length,
    risks: actions.filter((a) => a.type === 'RISK_CANDIDATE').length,
    capas: actions.filter((a) => a.type === 'CAPA_CANDIDATE').length,
    tasks: actions.filter((a) => a.type === 'TASK').length,
    evidence: actions.filter((a) => a.type === 'EVIDENCE').length,
    reportDraft: actions.filter((a) => a.type === 'REPORT_DRAFT').length,
    followUp: actions.filter((a) => a.type === 'FOLLOW_UP_ITEM').length,
  };
}
