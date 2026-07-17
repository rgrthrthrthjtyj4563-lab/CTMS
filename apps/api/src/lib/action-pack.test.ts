import { describe, it, expect } from 'vitest';
import { parseWithRules } from './ai.js';
import { countActionTypes } from './action-pack.js';
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