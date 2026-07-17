/**
 * Lightweight knowledge / classification rules for IMV Agent MVP.
 * Not a full KB platform — constants only; AI must pick from these enums.
 */

/** Product-level Issue category codes (AI must choose from this set). */
export const ISSUE_CATEGORY_ENUM = [
  'PROTOCOL_DEVIATION', // 方案偏离候选
  'SUSPECTED_AE', // 疑似 AE
  'SUSPECTED_SAE', // 疑似 SAE
  'LAB_ABNORMAL', // 实验室异常值
  'ICF', // 知情同意问题
  'SOURCE_RECORD', // 原始记录问题
  'DRUG_ACCOUNTABILITY', // 药品管理问题
  'EDC_DATA', // 数据录入/EDC 问题
  'DEVICE_SAMPLE_LOGISTICS', // 设备/样本/物流问题
  'FOLLOW_UP_COMM', // 沟通跟进问题
  'DOCUMENTATION', // 兼容旧规则
  'OTHER',
] as const;

export type IssueCategoryCode = (typeof ISSUE_CATEGORY_ENUM)[number];

export const ISSUE_CATEGORY_LABEL: Record<string, string> = {
  PROTOCOL_DEVIATION: '方案偏离候选',
  SUSPECTED_AE: '疑似 AE',
  SUSPECTED_SAE: '疑似 SAE',
  LAB_ABNORMAL: '实验室异常值',
  ICF: '知情同意问题',
  SOURCE_RECORD: '原始记录问题',
  DRUG_ACCOUNTABILITY: '药品管理问题',
  EDC_DATA: '数据录入/EDC 问题',
  DEVICE_SAMPLE_LOGISTICS: '设备/样本/物流问题',
  FOLLOW_UP_COMM: '沟通跟进问题',
  DOCUMENTATION: '原始记录问题',
  OTHER: '其他',
};

/** Coarse severity for MVP (maps to domain HIGH/MEDIUM/LOW for persistence). */
export type SeverityBucket = 'Critical' | 'Major' | 'Minor';

export function severityToDomain(bucket: SeverityBucket): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (bucket === 'Critical') return 'CRITICAL';
  if (bucket === 'Major') return 'HIGH';
  return 'MEDIUM';
}

export function normalizeIssueCategory(raw: string | undefined): IssueCategoryCode {
  if (!raw) return 'OTHER';
  const u = raw.toUpperCase();
  if ((ISSUE_CATEGORY_ENUM as readonly string[]).includes(u)) return u as IssueCategoryCode;
  // legacy / natural language
  if (/知情|ICF|consent/i.test(raw)) return 'ICF';
  if (/药物|药品|温度|药房/i.test(raw)) return 'DRUG_ACCOUNTABILITY';
  if (/原始|病历|签字|源数据/i.test(raw)) return 'SOURCE_RECORD';
  if (/方案偏离|PD/i.test(raw)) return 'PROTOCOL_DEVIATION';
  if (/\bSAE\b|严重不良/i.test(raw)) return 'SUSPECTED_SAE';
  if (/\bAE\b|不良事件/i.test(raw)) return 'SUSPECTED_AE';
  if (/实验室|化验|异常值/i.test(raw)) return 'LAB_ABNORMAL';
  if (/EDC|录入/i.test(raw)) return 'EDC_DATA';
  if (/DOCUMENTATION/i.test(raw)) return 'SOURCE_RECORD';
  return 'OTHER';
}

/**
 * Suggested downstream actions for a category (informational for generators / UI).
 * AI still produces candidates; human must confirm. AE/SAE never auto-finalized.
 */
export const CATEGORY_ACTION_MAP: Record<
  string,
  { actions: string[]; note?: string }
> = {
  PROTOCOL_DEVIATION: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
  },
  SUSPECTED_AE: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
    note: '仅标为疑似 AE，须医学/安全人工确认',
  },
  SUSPECTED_SAE: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
    note: '仅标为疑似 SAE，须医学/安全人工确认，注意时限',
  },
  LAB_ABNORMAL: {
    actions: ['ISSUE', 'TASK'],
  },
  ICF: {
    actions: ['ISSUE', 'CAPA_CANDIDATE', 'TASK'],
  },
  SOURCE_RECORD: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
  },
  DRUG_ACCOUNTABILITY: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
  },
  EDC_DATA: {
    actions: ['ISSUE', 'TASK'],
  },
  DEVICE_SAMPLE_LOGISTICS: {
    actions: ['ISSUE', 'TASK'],
  },
  FOLLOW_UP_COMM: {
    actions: ['TASK', 'FOLLOW_UP_ITEM'],
  },
  DOCUMENTATION: {
    actions: ['ISSUE', 'TASK', 'REPORT_DRAFT'],
  },
  OTHER: {
    actions: ['ISSUE', 'TASK'],
  },
};

export function inferSeverityBucket(opts: {
  category: string;
  text?: string;
}): SeverityBucket {
  const { category, text = '' } = opts;
  if (category === 'SUSPECTED_SAE' || /受试者安全|主要终点|SAE/i.test(text)) {
    return 'Critical';
  }
  if (
    category === 'SUSPECTED_AE' ||
    category === 'ICF' ||
    category === 'PROTOCOL_DEVIATION' ||
    /CAPA|合规|关键数据/i.test(text)
  ) {
    return 'Major';
  }
  return 'Minor';
}
