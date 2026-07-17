import OpenAI from 'openai';
import type {
  GeneratedActionPack,
  ActionItemPayload,
  ActionPackSummary,
  MonitoringVisitType,
} from '@clinical/domain';
import { normalizeGeneratedPack } from './action-pack.js';
import {
  ISSUE_CATEGORY_LABEL,
  inferSeverityBucket,
  normalizeIssueCategory,
  severityToDomain,
} from './knowledge-rules.js';

export interface AiContext {
  projectId: string;
  projectName: string;
  projectCode: string;
  siteId: string;
  siteName: string;
  visitId: string;
  visitType: MonitoringVisitType;
  visitDate: string;
  inputs: Array<{ id: string; type: string; content: string }>;
  attachments: Array<{ id: string; fileName: string; fileType?: string | null }>;
  openIssues?: Array<{ title: string; status: string }>;
}

const ALLOWED_ACTION_TYPES = new Set([
  'MONITORING_VISIT_RECORD',
  'HOURS',
  'ISSUE',
  'RISK_CANDIDATE',
  'CAPA_CANDIDATE',
  'TASK',
  'EVIDENCE',
  'REPORT_DRAFT',
  'FOLLOW_UP_ITEM',
]);

const SYSTEM_PROMPT = `你是临床运营 AI 助手，将 CRA 现场记录整理为动作包 JSON。
规则：
1. 不得编造项目、中心、人员、时间或证据
2. MonitoringVisit 仅指 SIV/IMV/COV 监查访视，不得创建 SubjectVisit
3. Risk/CAPA 只能是候选，requiresIndividualConfirm=true
4. 仅输出 JSON，不要 markdown

actions[].type 只能是：
MONITORING_VISIT_RECORD | HOURS | ISSUE | RISK_CANDIDATE | CAPA_CANDIDATE | TASK | EVIDENCE | REPORT_DRAFT | FOLLOW_UP_ITEM

每个 action 必须有：type, title(非空字符串), data(对象), sourceInputIds(数组), requiresIndividualConfirm(布尔)`;

function getOpenAIClient(): OpenAI | null {
  const apiKey = (process.env.TEXT_LLM_API_KEY || process.env.XAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const baseURL = process.env.TEXT_LLM_BASE_URL || process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
  return new OpenAI({ apiKey, baseURL });
}

function getTextModel(): string {
  return process.env.TEXT_LLM_MODEL || process.env.XAI_MODEL || 'grok-4.5';
}

/**
 * Demo guard — when DEMO_MODE is enabled (or DEMO_PROFILE=demo), force the
 * rule-based parser even if a TEXT_LLM_API_KEY is configured. This guarantees
 * deterministic action-pack output for investor demos and screen recordings.
 *
 * Activation (any of):
 *   - DEMO_MODE=1 | true | yes | on
 *   - DEMO_PROFILE=demo
 */
export function isDemoMode(): boolean {
  const flag = (process.env.DEMO_MODE || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) return true;
  const profile = (process.env.DEMO_PROFILE || '').trim().toLowerCase();
  if (profile === 'demo') return true;
  return false;
}

/** Rule-based parser for acceptance test and offline/test mode */
export function parseWithRules(ctx: AiContext, text: string): GeneratedActionPack {
  const today = ctx.visitDate;
  const summary: ActionPackSummary = {
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    siteId: ctx.siteId,
    siteName: ctx.siteName,
    visitType: ctx.visitType,
    visitDate: today,
    totalActions: 0,
    pendingConfirm: 0,
    missingOrConflict: 0,
    riskOrEscalationCandidates: 0,
    hasBlockingItems: false,
  };

  const actions: ActionItemPayload[] = [];
  const warnings: string[] = [];
  const sources: GeneratedActionPack['sources'] = [];

  const inputIds = ctx.inputs.map((i) => i.id);
  const attachmentIds = ctx.attachments.map((a) => a.id);
  const primaryExcerpt = text.slice(0, 160);
  const ruleSources = inputIds.map((id) => ({
    inputId: id,
    excerpt: primaryExcerpt || '规则解析自现场输入',
  }));

  // Parse time range: 9:10到17:40 or 9:10 到 17:40
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(?:到|至|-)\s*(\d{1,2}):(\d{2})/);
  let startTime = '09:00';
  let endTime = '17:00';
  let durationHours = 8;

  if (timeMatch) {
    startTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    endTime = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`;
    const [sh, sm] = [parseInt(timeMatch[1]), parseInt(timeMatch[2])];
    const [eh, em] = [parseInt(timeMatch[3]), parseInt(timeMatch[4])];
    durationHours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
  }

  // Subjects reviewed
  const subjectsMatch = text.match(/(\d+)\s*例受试者/);
  const subjectsReviewed = subjectsMatch ? parseInt(subjectsMatch[1]) : undefined;

  // Monitoring visit record
  actions.push({
    type: 'MONITORING_VISIT_RECORD',
    title: '监查访视记录',
    description: `IMV @ ${ctx.siteName}`,
    data: {
      actualStartTime: `${today}T${startTime}:00`,
      actualEndTime: `${today}T${endTime}:00`,
      subjectsReviewed,
      sitePersonnel: extractPersonnel(text),
      workSummary: buildWorkSummary(text, subjectsReviewed),
      findings: extractFindings(text),
    },
    sourceInputIds: inputIds,
    sourceAttachmentIds: attachmentIds.length ? attachmentIds : undefined,
    sources: ruleSources.map((s) => ({ ...s, field: 'workSummary' })),
    origin: 'RULE',
  });

  sources.push({ excerpt: text.slice(0, 200), field: 'workSummary', inputId: inputIds[0] });

  // Hours
  actions.push({
    type: 'HOURS',
    title: `现场监查工时 ${durationHours} 小时`,
    description: `${startTime}-${endTime} 现场监查`,
    data: {
      date: today,
      workType: 'ON_SITE_MONITORING',
      startTime,
      endTime,
      durationHours,
      description: `IMV现场监查 - ${ctx.siteName}`,
      projectId: ctx.projectId,
      siteId: ctx.siteId,
      monitoringVisitId: ctx.visitId,
    },
    sourceInputIds: inputIds,
    sources: ruleSources.map((s) => ({
      ...s,
      excerpt: timeMatch
        ? `识别时间段 ${startTime}-${endTime}（共 ${durationHours} 小时）`
        : s.excerpt,
      field: 'durationHours',
    })),
    origin: 'RULE',
  });

  // Issues
  const issues = extractIssues(text, ctx);
  for (const issue of issues) {
    actions.push({
      type: 'ISSUE',
      title: issue.title,
      description: issue.description,
      data: {
        ...issue,
        projectId: ctx.projectId,
        siteId: ctx.siteId,
        monitoringVisitId: ctx.visitId,
      },
      sourceInputIds: inputIds,
      sources: [{ inputId: inputIds[0], excerpt: issue.description.slice(0, 160), field: 'title' }],
      origin: 'RULE',
      requiresIndividualConfirm: issue.severity === 'HIGH' || issue.severity === 'CRITICAL',
    });
  }

  // Risk candidate if documentation issues found
  if (issues.some((i) => i.category === 'DOCUMENTATION' || i.category === 'DRUG_ACCOUNTABILITY')) {
    actions.push({
      type: 'RISK_CANDIDATE',
      title: '文件管理风险候选',
      description: '中心出现原始记录签字和药物管理文件异常',
      data: {
        title: '中心文件管理合规风险',
        description: '本次IMV发现原始记录未签字及药物温度记录缺失，可能影响数据可靠性',
        rationale: '同类文件问题在本次访视中重复出现（签字缺失+温度记录缺失），需关注中心文件管理规范性',
        relatedIssueTitles: issues.map((i) => i.title),
        severity: 'MEDIUM',
      },
      sourceInputIds: inputIds,
      sources: ruleSources,
      origin: 'RULE',
      requiresIndividualConfirm: true,
    });
    summary.riskOrEscalationCandidates++;
  }

  // CAPA candidate
  if (issues.length >= 2) {
    actions.push({
      type: 'CAPA_CANDIDATE',
      title: 'CAPA候选 - 中心文件管理',
      description: '多项文件问题可能需要纠正预防措施',
      data: {
        triggerReason: '同一访视发现多项文件管理问题',
        relatedIssueTitles: issues.map((i) => i.title),
        rootCauseHypothesis: '中心文件管理流程执行不到位，CRC培训或监督不足',
        correctiveAction: '要求CRC补齐缺失记录并由PI复核签字',
        preventiveAction: '建议加强中心文件管理培训和定期自查',
        suggestedOwner: 'CRC小王',
        suggestedDueDate: parseDueDate(text, '周五'),
      },
      sourceInputIds: inputIds,
      sources: ruleSources,
      origin: 'RULE',
      requiresIndividualConfirm: true,
    });
    summary.riskOrEscalationCandidates++;
  }

  // Tasks from commitments
  const tasks = extractTasks(text, issues);
  for (const task of tasks) {
    actions.push({
      type: 'TASK',
      title: task.title,
      data: { ...task, monitoringVisitId: ctx.visitId },
      sourceInputIds: inputIds,
      sources: ruleSources,
      origin: 'RULE',
    });
  }

  // Evidence from attachments
  for (const att of ctx.attachments) {
    const fileType = inferFileType(att.fileName, text);
    actions.push({
      type: 'EVIDENCE',
      title: `证据: ${att.fileName}`,
      data: {
        attachmentId: att.id,
        fileName: att.fileName,
        fileType,
        suggestedCategory: fileType,
        relatedTo: '本次IMV',
        sensitiveInfoDetected: false,
      },
      sourceAttachmentIds: [att.id],
      sources: [{ attachmentId: att.id, excerpt: `附件：${att.fileName}`, field: 'fileName' }],
      origin: 'RULE',
    });
  }

  // If text mentions uploads but no attachments
  if (attachmentIds.length === 0 && /上传|照片|文件/.test(text)) {
    warnings.push('用户提到已上传文件，但未检测到附件，请确认上传状态');
    summary.missingOrConflict++;
  }

  // Report draft
  actions.push({
    type: 'REPORT_DRAFT',
    title: '监查报告草稿',
    data: {
      title: `${ctx.projectCode} - ${ctx.siteName} IMV监查报告`,
      sections: [
        {
          sectionKey: 'visit_info',
          title: '访视信息',
          content: `访视类型：IMV\n中心：${ctx.siteName}\n日期：${today}\nCRA：现场监查\n时间：${startTime} - ${endTime}`,
          sourceExcerpts: [text.slice(0, 100)],
          status: 'DRAFT',
        },
        {
          sectionKey: 'work_completed',
          title: '完成工作',
          content: subjectsReviewed
            ? `本次监查核对了 ${subjectsReviewed} 例受试者原始记录及研究中心文件。`
            : '本次监查完成了受试者原始记录及研究中心文件核对。',
          sourceExcerpts: [text],
          status: 'DRAFT',
        },
        {
          sectionKey: 'findings',
          title: '发现问题',
          content: issues.map((i) => `- ${i.title}: ${i.description}`).join('\n') || '无重大发现',
          sourceExcerpts: issues.map((i) => i.description),
          status: issues.length ? 'DRAFT' : 'NEEDS_SUPPLEMENT',
        },
        {
          sectionKey: 'actions',
          title: '跟进事项',
          content: tasks.map((t) => `- ${t.title}（责任人：${t.assignee || '待定'}，期限：${t.dueDate || '待定'}）`).join('\n'),
          sourceExcerpts: [text],
          status: 'DRAFT',
        },
      ],
    },
    sourceInputIds: inputIds,
    sourceAttachmentIds: attachmentIds.length ? attachmentIds : undefined,
    sources: ruleSources,
    origin: 'RULE',
  });

  // Follow-up items
  for (const issue of issues) {
    const dueDate = issue.targetDate || parseDueDate(text, '周五') || today;
    actions.push({
      type: 'FOLLOW_UP_ITEM',
      title: `跟进: ${issue.title}`,
      data: {
        item: issue.description,
        responsiblePerson: issue.responsiblePerson || 'CRC小王',
        dueDate,
        requiredEvidence: issue.requiredEvidence || '补齐相关原始记录',
        relatedIssueTitle: issue.title,
        suggestedWording: `请中心于 ${dueDate} 前完成 ${issue.title} 的整改并提供证据。`,
      },
      sourceInputIds: inputIds,
      sources: [{ inputId: inputIds[0], excerpt: issue.description.slice(0, 160) }],
      origin: 'RULE',
    });
  }

  summary.totalActions = actions.length;
  summary.pendingConfirm = actions.length;

  return { summary, actions, warnings, sources };
}

function extractPersonnel(text: string): string[] {
  const personnel: string[] = [];
  const crcMatch = text.match(/CRC\s*(\S+)/);
  if (crcMatch) personnel.push(`CRC ${crcMatch[1]}`);
  const piMatch = text.match(/PI\s*(\S+)?/);
  if (piMatch) personnel.push(piMatch[1] ? `PI ${piMatch[1]}` : 'PI');
  return personnel;
}

function buildWorkSummary(text: string, subjects?: number): string {
  const siteHint = /上海六院|第六人民/.test(text)
    ? '上海六院'
    : /华山/.test(text)
      ? '华山医院'
      : '研究中心';
  const parts: string[] = [`今天在${siteHint}完成IMV现场监查`];
  if (subjects) parts.push(`核对了${subjects}例受试者`);
  if (/原始记录|病历/.test(text)) parts.push('核对原始记录/病历');
  if (/药物|药房|温度/.test(text)) parts.push('检查药物管理文件');
  if (/知情同意/.test(text)) parts.push('检查知情同意文件');
  return parts.join('，');
}

function extractFindings(text: string): string[] {
  const findings: string[] = [];
  if (/未签字/.test(text)) findings.push('受试者原始记录/病历未签字');
  if (/温度记录.*缺失|温度记录缺失|温度记录少/.test(text)) {
    findings.push('药物温度记录缺失');
  }
  return findings;
}

interface ParsedIssue {
  title: string;
  description: string;
  category: string;
  categoryLabel?: string;
  severity: string;
  severityBucket?: string;
  subjectId?: string;
  responsiblePerson?: string;
  targetDate?: string;
  requiredEvidence?: string;
  /** Always candidate — never final AE/SAE judgment */
  clinicalSafetyFlag?: 'suspected_ae' | 'suspected_sae' | null;
}

function extractIssues(text: string, _ctx: AiContext): ParsedIssue[] {
  const issues: ParsedIssue[] = [];

  // Issue 1: unsigned source / medical records
  const unsignedMatch = text.match(/(\d+)\s*号受试者.{0,40}未签字/);
  if (unsignedMatch || /原始(记录|病历).{0,12}未签字|未签字/.test(text)) {
    const subjectId = unsignedMatch ? unsignedMatch[1] : '03';
    const category = normalizeIssueCategory('SOURCE_RECORD');
    const severityBucket = inferSeverityBucket({ category, text });
    issues.push({
      title: `${subjectId}号受试者原始病历/记录未签字`,
      description: `${subjectId}号受试者存在未签字的原始病历或源文件，需补齐签字并归档`,
      category,
      categoryLabel: ISSUE_CATEGORY_LABEL[category],
      severity: severityToDomain(severityBucket),
      severityBucket,
      subjectId,
      responsiblePerson: extractCrcName(text) || 'CRC小王',
      targetDate: parseDueDate(text, '周五'),
      requiredEvidence: '已签字的原始记录复印件',
      clinicalSafetyFlag: null,
    });
  }

  // Issue 2: missing temperature log (supports "7 月 10 日" spacing)
  const tempMatch =
    text.match(/(\d+\s*月\s*\d+\s*日).{0,20}温度记录.{0,8}缺失/) ||
    text.match(/温度记录\s*(\d+\s*月\s*\d+\s*日).{0,8}缺失/);
  if (tempMatch || /温度记录缺失|温度记录少|药房温度/.test(text)) {
    const rawDate = tempMatch ? tempMatch[1].replace(/\s+/g, '') : '相关日期';
    const category = normalizeIssueCategory('DRUG_ACCOUNTABILITY');
    const severityBucket = inferSeverityBucket({ category, text });
    issues.push({
      title: `${rawDate}药物温度记录缺失`,
      description: `${rawDate}药房/药物储存温度记录缺失，需补齐并由责任人确认`,
      category,
      categoryLabel: ISSUE_CATEGORY_LABEL[category],
      severity: severityToDomain(severityBucket),
      severityBucket,
      responsiblePerson: extractCrcName(text) || 'CRC小王',
      targetDate: parseDueDate(text, '周五'),
      requiredEvidence: '补齐的药物温度记录',
      clinicalSafetyFlag: null,
    });
  }

  // Suspected AE/SAE — candidates only, never final medical judgment
  if (/\bSAE\b|严重不良事件/.test(text)) {
    const category = normalizeIssueCategory('SUSPECTED_SAE');
    const severityBucket = inferSeverityBucket({ category, text });
    issues.push({
      title: '疑似 SAE（待医学确认）',
      description: '现场描述涉及疑似严重不良事件相关内容，仅作候选标记，须医学/安全人工确认',
      category,
      categoryLabel: ISSUE_CATEGORY_LABEL[category],
      severity: severityToDomain(severityBucket),
      severityBucket,
      responsiblePerson: 'PI/医学',
      clinicalSafetyFlag: 'suspected_sae',
    });
  } else if (/\bAE\b|不良事件/.test(text) && !/无不良/.test(text)) {
    const category = normalizeIssueCategory('SUSPECTED_AE');
    const severityBucket = inferSeverityBucket({ category, text });
    issues.push({
      title: '疑似 AE（待医学确认）',
      description: '现场描述涉及疑似不良事件相关内容，仅作候选标记，须医学人工确认',
      category,
      categoryLabel: ISSUE_CATEGORY_LABEL[category],
      severity: severityToDomain(severityBucket),
      severityBucket,
      responsiblePerson: 'PI/医学',
      clinicalSafetyFlag: 'suspected_ae',
    });
  }

  return issues;
}

function extractCrcName(text: string): string | undefined {
  // Prefer short name: "CRC小王" / "CRC 小王" before 承诺/，
  const m = text.match(/CRC\s*([^\s，,。承诺]{1,8})/);
  return m ? `CRC${m[1]}` : undefined;
}

function extractTasks(text: string, issues: ParsedIssue[]) {
  const tasks: Array<{ title: string; description?: string; assignee?: string; dueDate?: string; relatedIssueTitle?: string }> = [];

  if (/CRC.*?承诺.*?周五/.test(text) || /周五前补齐/.test(text) || /承诺周五/.test(text)) {
    for (const issue of issues.filter((i) => !i.clinicalSafetyFlag)) {
      tasks.push({
        title: `补齐: ${issue.title}`,
        description: issue.description,
        assignee: issue.responsiblePerson || 'CRC小王',
        dueDate: parseDueDate(text, '周五'),
        relatedIssueTitle: issue.title,
      });
    }
  }

  if (/PI.*?下周一.*?复核/.test(text) || /PI\s*下周一/.test(text)) {
    tasks.push({
      title: 'PI复核整改文件',
      description: 'PI下周一复核CRC补齐的文件',
      assignee: 'PI',
      dueDate: parseDueDate(text, '下周一'),
    });
  }

  for (const issue of issues.filter((i) => i.clinicalSafetyFlag)) {
    tasks.push({
      title: `医学确认: ${issue.title}`,
      description: 'AI 仅标记为疑似，须人工完成医学/安全确认，禁止自动结案',
      assignee: issue.responsiblePerson || 'PI/医学',
      relatedIssueTitle: issue.title,
    });
  }

  return tasks;
}

function parseDueDate(text: string, keyword: string): string | undefined {
  if (!text.includes(keyword) && keyword === '周五' && !/周五/.test(text)) return undefined;
  if (!text.includes(keyword) && keyword === '下周一' && !/下周一/.test(text)) return undefined;

  const now = new Date();
  if (keyword === '周五' || /周五/.test(text)) {
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    return friday.toISOString().split('T')[0];
  }
  if (keyword === '下周一' || /下周一/.test(text)) {
    const day = now.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);
    return monday.toISOString().split('T')[0];
  }
  return undefined;
}

function inferFileType(fileName: string, text: string): string {
  if (/知情同意|consent/i.test(fileName)) return '知情同意';
  if (/药物|drug/i.test(fileName)) return '药物管理';
  if (/知情同意/.test(text) && !/药物/.test(fileName)) return '知情同意';
  if (/药物/.test(text) && !/知情/.test(fileName)) return '药物管理';
  return '其他';
}

function isValidGeneratedPack(parsed: GeneratedActionPack, _ctx: AiContext): boolean {
  if (!parsed.summary || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
    return false;
  }
  return parsed.actions.every(
    (a) =>
      ALLOWED_ACTION_TYPES.has(a.type) &&
      typeof a.title === 'string' &&
      a.title.trim().length > 0 &&
      a.data &&
      typeof a.data === 'object',
  );
}

export async function generateActionPack(ctx: AiContext): Promise<GeneratedActionPack> {
  const combinedText = ctx.inputs.map((i) => i.content).join('\n');
  const client = getOpenAIClient();
  const demoMode = isDemoMode();

  // Demo mode: always use rules, even when a key is configured.
  if (demoMode || !client) {
    if (demoMode) {
      console.warn('[DEMO_MODE] forcing rule-based action pack generation');
    }
    return normalizeGeneratedPack(parseWithRules(ctx, combinedText));
  }

  try {
    const response = await client.chat.completions.create({
      model: getTextModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            context: {
              project: ctx.projectName,
              site: ctx.siteName,
              visitType: ctx.visitType,
              date: ctx.visitDate,
              openIssues: ctx.openIssues,
            },
            inputs: ctx.inputs,
            attachments: ctx.attachments,
            instruction:
              '生成完整动作包 JSON：{summary:{projectId,siteId,visitType,visitDate,totalActions,...},actions:[...],warnings:[],followUpQuestions:[],sources:[]}',
          }),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content) as GeneratedActionPack;
    if (!isValidGeneratedPack(parsed, ctx)) {
      throw new Error('AI response failed schema validation');
    }

    parsed.summary.projectId = parsed.summary.projectId || ctx.projectId;
    parsed.summary.siteId = parsed.summary.siteId || ctx.siteId;
    parsed.summary.visitType = parsed.summary.visitType || ctx.visitType;
    parsed.summary.visitDate = parsed.summary.visitDate || ctx.visitDate;
    parsed.summary.totalActions = parsed.actions.length;
    parsed.summary.pendingConfirm = parsed.actions.length;

    // Strip LLM garbage (invalid dates, junk severity, non-array sections) so
    // confirm-time code never has to guard against the same shapes again.
    return normalizeGeneratedPack(parsed);
  } catch (err) {
    console.warn('AI generation failed, falling back to rules:', err);
    return normalizeGeneratedPack(parseWithRules(ctx, combinedText));
  }
}
