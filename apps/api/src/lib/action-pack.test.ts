import { afterEach, describe, it, expect } from 'vitest';
import { parseWithRules } from './ai.js';
import {
  countActionTypes,
  normalizeActionItemData,
  normalizeGeneratedPack,
  normalizeSeverity,
  parseOptionalDate,
  resolvePackModelMeta,
  toDateOnly,
  toIsoDate,
} from './action-pack.js';
import type { AiContext } from './ai.js';

const ACCEPTANCE_INPUT =
  '今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。CRC小王承诺周五前补齐，PI下周一复核。我已经上传知情同意和药物管理文件照片。';

const baseContext: AiContext = {
  projectId: 'proj-1',
  projectName: 'AJ-001',
  projectCode: 'AJ-001',
  siteId: 'site-1',
  siteName: '华山医院',
  visitId: 'visit-1',
  visitType: 'IMV',
  visitDate: '2026-07-15',
  inputs: [{ id: 'input-1', type: 'TEXT', content: ACCEPTANCE_INPUT }],
  attachments: [
    { id: 'att-1', fileName: '知情同意照片.jpg' },
    { id: 'att-2', fileName: '药物管理文件.jpg' },
  ],
};

describe('parseWithRules - acceptance scenario', () => {
  it('generates IMV record with correct times', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const mvAction = result.actions.find((a) => a.type === 'MONITORING_VISIT_RECORD');
    expect(mvAction).toBeDefined();
    const data = mvAction!.data as Record<string, unknown>;
    expect(data.subjectsReviewed).toBe(12);
    expect(data.actualStartTime).toContain('09:10');
    expect(data.actualEndTime).toContain('17:40');
  });

  it('generates 8.5 hours of on-site monitoring', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const hoursAction = result.actions.find((a) => a.type === 'HOURS');
    expect(hoursAction).toBeDefined();
    const data = hoursAction!.data as Record<string, unknown>;
    expect(data.durationHours).toBe(8.5);
    expect(data.workType).toBe('ON_SITE_MONITORING');
  });

  it('splits into 2 issues', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const issues = result.actions.filter((a) => a.type === 'ISSUE');
    expect(issues).toHaveLength(2);
    expect(issues[0].title).toContain('03号受试者');
    expect(issues[0].title).toContain('未签字');
    expect(issues[1].title).toContain('温度记录缺失');
  });

  it('records responsible persons and commitments', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const issues = result.actions.filter((a) => a.type === 'ISSUE');
    for (const issue of issues) {
      const data = issue.data as Record<string, unknown>;
      expect(data.responsiblePerson).toBe('CRC小王');
      expect(data.targetDate).toBeDefined();
    }

    const tasks = result.actions.filter((a) => a.type === 'TASK');
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    const piTask = tasks.find((t) => (t.data as Record<string, unknown>).assignee === 'PI');
    expect(piTask).toBeDefined();
  });

  it('generates risk and CAPA candidates with rationale', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const risks = result.actions.filter((a) => a.type === 'RISK_CANDIDATE');
    const capas = result.actions.filter((a) => a.type === 'CAPA_CANDIDATE');
    expect(risks.length).toBeGreaterThanOrEqual(1);
    expect(capas.length).toBeGreaterThanOrEqual(1);

    const riskData = risks[0].data as Record<string, unknown>;
    expect(riskData.rationale).toBeDefined();
    expect(risks[0].requiresIndividualConfirm).toBe(true);
    expect(capas[0].requiresIndividualConfirm).toBe(true);
  });

  it('generates tasks, evidence, report draft, and follow-up items', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const counts = countActionTypes(result.actions);

    expect(counts.monitoringVisit).toBe(1);
    expect(counts.hours).toBe(1);
    expect(counts.issues).toBe(2);
    expect(counts.tasks).toBeGreaterThanOrEqual(1);
    expect(counts.evidence).toBe(2);
    expect(counts.reportDraft).toBe(1);
    expect(counts.followUp).toBe(2);
    expect(counts.risks).toBeGreaterThanOrEqual(1);
    expect(counts.capas).toBeGreaterThanOrEqual(1);
  });

  it('includes sources for traceability', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    expect(result.sources).toBeDefined();
    expect(result.sources!.length).toBeGreaterThan(0);

    const reportAction = result.actions.find((a) => a.type === 'REPORT_DRAFT');
    const reportData = reportAction!.data as { sections: Array<{ sourceExcerpts?: string[] }> };
    expect(reportData.sections.some((s) => s.sourceExcerpts && s.sourceExcerpts.length > 0)).toBe(
      true,
    );
  });

  it('associates evidence with uploaded attachments', () => {
    const result = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    const evidence = result.actions.filter((a) => a.type === 'EVIDENCE');
    expect(evidence).toHaveLength(2);
    const types = evidence.map((e) => (e.data as Record<string, unknown>).fileType);
    expect(types).toContain('知情同意');
    expect(types).toContain('药物管理');
  });
});

describe('parseOptionalDate', () => {
  it('returns undefined for empty/null/garbage', () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
    expect(parseOptionalDate(null)).toBeUndefined();
    expect(parseOptionalDate('')).toBeUndefined();
    expect(parseOptionalDate('补齐')).toBeUndefined();
    expect(parseOptionalDate('下周某天')).toBeUndefined();
    expect(parseOptionalDate({})).toBeUndefined();
  });

  it('returns Date for valid ISO / YYYY-MM-DD / Date instance', () => {
    const a = parseOptionalDate('2026-08-01T00:00:00.000Z');
    expect(a).toBeInstanceOf(Date);
    expect(a!.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(parseOptionalDate('2026-08-01')?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    const d = new Date('2026-07-15T09:10:00Z');
    expect(parseOptionalDate(d)).toEqual(d);
  });

  it('returns undefined for invalid Date instance', () => {
    expect(parseOptionalDate(new Date('not-a-date'))).toBeUndefined();
  });

  it('formats ISO and date-only consistently', () => {
    const d = new Date('2026-07-15T01:10:00.000Z');
    expect(toIsoDate(d)).toBe('2026-07-15T01:10:00.000Z');
    expect(toDateOnly(d)).toBe('2026-07-15');
  });
});

describe('normalizeSeverity', () => {
  it('maps LLM natural-language severities', () => {
    expect(normalizeSeverity('Major')).toBe('HIGH');
    expect(normalizeSeverity('Critical')).toBe('CRITICAL');
    expect(normalizeSeverity('Moderate')).toBe('MEDIUM');
    expect(normalizeSeverity('Minor')).toBe('LOW');
    expect(normalizeSeverity('HIGH')).toBe('HIGH');
  });
  it('falls back to MEDIUM for unknown / non-string', () => {
    expect(normalizeSeverity('weird')).toBe('MEDIUM');
    expect(normalizeSeverity(undefined)).toBe('MEDIUM');
    expect(normalizeSeverity(99)).toBe('MEDIUM');
  });
});

describe('normalizeActionItemData', () => {
  it('drops garbage date strings (TASK dueDate="补齐")', () => {
    const out = normalizeActionItemData('TASK', { title: 'x', dueDate: '补齐' });
    expect(out).not.toHaveProperty('dueDate');
    expect(out.title).toBe('x');
  });

  it('coerces valid ISO date to canonical ISO string (TASK)', () => {
    const out = normalizeActionItemData('TASK', {
      title: 'x',
      dueDate: '2026-08-01T00:00:00.000Z',
    });
    expect(out.dueDate).toBe('2026-08-01T00:00:00.000Z');
  });

  it('HOURS date becomes YYYY-MM-DD only', () => {
    const out = normalizeActionItemData('HOURS', {
      date: '2026-07-15T01:10:00.000Z',
      durationHours: 8.5,
    });
    expect(out.date).toBe('2026-07-15');
  });

  it('ISSUE targetDate dropped when garbage, severity mapped', () => {
    const out = normalizeActionItemData('ISSUE', {
      title: '原始记录未签字',
      targetDate: '补齐',
      severity: 'Major',
    });
    expect(out).not.toHaveProperty('targetDate');
    expect(out.severity).toBe('HIGH');
  });

  it('REPORT_DRAFT sections: non-array → empty array; empty title removed', () => {
    const out = normalizeActionItemData('REPORT_DRAFT', {
      sections: 'not-an-array',
      title: '   ',
    });
    expect(out.sections).toEqual([]);
    expect(out).not.toHaveProperty('title');
  });

  it('REPORT_DRAFT sections: filters non-object entries', () => {
    const out = normalizeActionItemData('REPORT_DRAFT', {
      sections: [
        { sectionKey: 'a', title: 'A' },
        null,
        'string',
        [1, 2],
        { sectionKey: 'b', title: 'B' },
      ],
      title: 'X',
    });
    expect(out.sections).toHaveLength(2);
    expect((out.sections as Array<Record<string, unknown>>)[0].sectionKey).toBe('a');
  });

  it('handles null/undefined input', () => {
    expect(normalizeActionItemData('TASK', null)).toEqual({});
    expect(normalizeActionItemData('TASK', undefined)).toEqual({});
  });
});

describe('normalizeGeneratedPack', () => {
  it('strips dirty fields across all action types', () => {
    const pack = parseWithRules(baseContext, ACCEPTANCE_INPUT);
    // Inject dirty overrides before normalization
    const task = pack.actions.find((a) => a.type === 'TASK')!;
    (task.data as Record<string, unknown>).dueDate = '补齐';
    const issue = pack.actions.find((a) => a.type === 'ISSUE')!;
    (issue.data as Record<string, unknown>).targetDate = '下周某天';
    (issue.data as Record<string, unknown>).severity = 'Major';
    const report = pack.actions.find((a) => a.type === 'REPORT_DRAFT')!;
    (report.data as Record<string, unknown>).sections = 'not-an-array';

    const cleaned = normalizeGeneratedPack(pack);

    const cleanedTask = cleaned.actions.find((a) => a.type === 'TASK')!;
    expect(cleanedTask.data as Record<string, unknown>).not.toHaveProperty('dueDate');
    const cleanedIssue = cleaned.actions.find((a) => a.type === 'ISSUE')!;
    expect(cleanedIssue.data as Record<string, unknown>).not.toHaveProperty('targetDate');
    expect((cleanedIssue.data as Record<string, unknown>).severity).toBe('HIGH');
    const cleanedReport = cleaned.actions.find((a) => a.type === 'REPORT_DRAFT')!;
    expect((cleanedReport.data as Record<string, unknown>).sections).toEqual([]);
  });
});

describe('resolvePackModelMeta', () => {
  const keys = [
    'DEMO_MODE',
    'DEMO_PROFILE',
    'TEXT_LLM_API_KEY',
    'XAI_API_KEY',
    'TEXT_LLM_MODEL',
    'XAI_MODEL',
  ] as const;
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  function snapshotEnv() {
    for (const k of keys) prev[k] = process.env[k];
  }

  it('labels RULE/rules-demo when DEMO_MODE=1 even if LLM key is set', () => {
    snapshotEnv();
    process.env.DEMO_MODE = '1';
    process.env.TEXT_LLM_API_KEY = 'sk-test';
    process.env.TEXT_LLM_MODEL = 'gpt-test';
    delete process.env.XAI_API_KEY;
    expect(resolvePackModelMeta()).toEqual({ origin: 'RULE', model: 'rules-demo' });
  });

  it('labels MODEL when not demo and LLM key present', () => {
    snapshotEnv();
    delete process.env.DEMO_MODE;
    delete process.env.DEMO_PROFILE;
    process.env.TEXT_LLM_API_KEY = 'sk-test';
    process.env.TEXT_LLM_MODEL = 'gpt-test';
    delete process.env.XAI_API_KEY;
    expect(resolvePackModelMeta()).toEqual({ origin: 'MODEL', model: 'gpt-test' });
  });

  it('labels RULE/rules when not demo and no LLM key', () => {
    snapshotEnv();
    delete process.env.DEMO_MODE;
    delete process.env.DEMO_PROFILE;
    delete process.env.TEXT_LLM_API_KEY;
    delete process.env.XAI_API_KEY;
    expect(resolvePackModelMeta()).toEqual({ origin: 'RULE', model: 'rules' });
  });
});