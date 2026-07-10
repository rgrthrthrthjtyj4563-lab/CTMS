/**
 * Domain-level TypeScript types for the Web back-office.
 *
 * These mirror the seed data and dashboard API responses. They are
 * intentionally colocated with the components that render them so the
 * Phase 2 services can replace them with generated Prisma types
 * without touching the components.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const RISK_LEVELS: ReadonlyArray<RiskLevel> = [
  "low",
  "medium",
  "high",
  "critical",
];

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "紧急",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

export interface RiskVisual {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const RISK_VISUAL: Record<RiskLevel, RiskVisual> = {
  critical: {
    bg: "var(--risk-critical-bg)",
    text: "var(--risk-critical-text)",
    border: "var(--risk-critical-border)",
    dot: "var(--risk-critical-text)",
  },
  high: {
    bg: "var(--risk-high-bg)",
    text: "var(--risk-high-text)",
    border: "var(--risk-high-border)",
    dot: "var(--risk-high-text)",
  },
  medium: {
    bg: "var(--risk-medium-bg)",
    text: "var(--risk-medium-text)",
    border: "var(--risk-medium-border)",
    dot: "var(--risk-medium-text)",
  },
  low: {
    bg: "var(--risk-low-bg)",
    text: "var(--risk-low-text)",
    border: "var(--risk-low-border)",
    dot: "var(--risk-low-text)",
  },
};

export type SubjectStatus =
  | "screening"
  | "in-treatment"
  | "completed"
  | "dropout";

export const SUBJECT_STATUS_LABEL: Record<SubjectStatus, string> = {
  screening: "筛查期",
  "in-treatment": "治疗中",
  completed: "已完成",
  dropout: "已脱落",
};

export interface SubjectStatusVisual {
  bg: string;
  text: string;
}

export const SUBJECT_STATUS_VISUAL: Record<SubjectStatus, SubjectStatusVisual> = {
  screening: { bg: "#eff6ff", text: "#3b82f6" },
  "in-treatment": { bg: "#f0fdf4", text: "#16a34a" },
  completed: { bg: "#f5f3ff", text: "#7c3aed" },
  dropout: { bg: "#fef2f2", text: "#dc2626" },
};

export type RiskWorkflowStatus = "pending" | "processing" | "resolved";

export const RISK_WORKFLOW_LABEL: Record<RiskWorkflowStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
};

export const RISK_WORKFLOW_VISUAL: Record<RiskWorkflowStatus, SubjectStatusVisual> = {
  pending: { bg: "#fffbeb", text: "#d97706" },
  processing: { bg: "#eff6ff", text: "#3b82f6" },
  resolved: { bg: "#f0fdf4", text: "#16a34a" },
};
