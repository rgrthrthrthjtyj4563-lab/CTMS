/**
 * AIC-DCT Core Domain Enums
 *
 * These are the canonical lifecycle and classification enums for the entire
 * platform. All apps MUST import these from @aic-dct/domain rather than
 * declaring their own ad-hoc string unions.
 */

import { z } from "zod";

// ─── Roles ───────────────────────────────────────────────────
export const Role = {
  SponsorAdmin: "SponsorAdmin",
  CROPM: "CROPM",
  SitePI: "SitePI",
  SiteCRC: "SiteCRC",
  CRA: "CRA",
  Auditor: "Auditor",
  RegulatorReadOnly: "RegulatorReadOnly",
  Subject: "Subject",
  ProviderLogistics: "ProviderLogistics",
  ProviderNurse: "ProviderNurse",
  SystemAdmin: "SystemAdmin",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.nativeEnum(Role);

// ─── Protocol Parse Status ───────────────────────────────────
export const ProtocolParseStatus = {
  Uploaded: "Uploaded",
  Parsing: "Parsing",
  Parsed: "Parsed",
  ParseFailed: "ParseFailed",
  UnderReview: "UnderReview",
  Effective: "Effective",
  Superseded: "Superseded",
} as const;
export type ProtocolParseStatus =
  (typeof ProtocolParseStatus)[keyof typeof ProtocolParseStatus];
export const ProtocolParseStatusSchema = z.nativeEnum(ProtocolParseStatus);

// ─── Human Confirmation Status ───────────────────────────────
export const HumanConfirmationStatus = {
  Pending: "Pending",
  Adopted: "Adopted",
  EditedAdopted: "EditedAdopted",
  Rejected: "Rejected",
  NeedsInvestigatorConfirmation: "NeedsInvestigatorConfirmation",
} as const;
export type HumanConfirmationStatus =
  (typeof HumanConfirmationStatus)[keyof typeof HumanConfirmationStatus];
export const HumanConfirmationStatusSchema = z.nativeEnum(
  HumanConfirmationStatus,
);

// ─── Subject Status ──────────────────────────────────────────
export const SubjectStatus = {
  PreScreening: "PreScreening",
  Consenting: "Consenting",
  Screening: "Screening",
  Enrolled: "Enrolled",
  Active: "Active",
  Completed: "Completed",
  Withdrawn: "Withdrawn",
  ScreenFailed: "ScreenFailed",
} as const;
export type SubjectStatus = (typeof SubjectStatus)[keyof typeof SubjectStatus];
export const SubjectStatusSchema = z.nativeEnum(SubjectStatus);

/** Allowed transitions for SubjectStatus. Centralized so backend services,
 * API routes, and tests all reference the same rules. */
export const SUBJECT_STATUS_TRANSITIONS: Record<SubjectStatus, SubjectStatus[]> = {
  PreScreening: ["Consenting", "ScreenFailed", "Withdrawn"],
  Consenting: ["Screening", "Withdrawn", "ScreenFailed"],
  Screening: ["Enrolled", "ScreenFailed", "Withdrawn"],
  Enrolled: ["Active", "Withdrawn", "ScreenFailed"],
  Active: ["Completed", "Withdrawn"],
  Completed: [],
  Withdrawn: [],
  ScreenFailed: [],
};

// ─── Visit Status ────────────────────────────────────────────
export const VisitStatus = {
  NotStarted: "NotStarted",
  Scheduled: "Scheduled",
  InProgress: "InProgress",
  SubmittedForPI: "SubmittedForPI",
  Completed: "Completed",
  Missed: "Missed",
  OutOfWindow: "OutOfWindow",
  Deviation: "Deviation",
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];
export const VisitStatusSchema = z.nativeEnum(VisitStatus);

export const VISIT_STATUS_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  NotStarted: ["Scheduled"],
  Scheduled: ["InProgress", "Missed", "OutOfWindow"],
  InProgress: ["SubmittedForPI", "Completed", "Deviation"],
  SubmittedForPI: ["Completed", "Deviation", "InProgress"],
  Completed: [],
  Missed: ["Scheduled", "Deviation"],
  OutOfWindow: ["Completed", "Deviation"],
  Deviation: ["Completed"],
};

// ─── Consent Status ──────────────────────────────────────────
export const ConsentStatus = {
  NotStarted: "NotStarted",
  Reading: "Reading",
  ComprehensionPending: "ComprehensionPending",
  SubjectSigned: "SubjectSigned",
  InvestigatorSigned: "InvestigatorSigned",
  Completed: "Completed",
  ReConsentRequired: "ReConsentRequired",
  Withdrawn: "Withdrawn",
} as const;
export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus];
export const ConsentStatusSchema = z.nativeEnum(ConsentStatus);

export const CONSENT_STATUS_TRANSITIONS: Record<ConsentStatus, ConsentStatus[]> = {
  NotStarted: ["Reading", "Withdrawn"],
  Reading: ["ComprehensionPending", "Withdrawn"],
  ComprehensionPending: ["SubjectSigned", "Reading", "Withdrawn"],
  SubjectSigned: ["InvestigatorSigned", "Withdrawn"],
  InvestigatorSigned: ["Completed", "Withdrawn"],
  Completed: ["ReConsentRequired", "Withdrawn"],
  ReConsentRequired: ["Reading", "Withdrawn"],
  Withdrawn: [],
};

// ─── Questionnaire Status ────────────────────────────────────
export const QuestionnaireStatus = {
  Scheduled: "Scheduled",
  InProgress: "InProgress",
  Submitted: "Submitted",
  Missed: "Missed",
  Late: "Late",
  Reviewed: "Reviewed",
} as const;
export type QuestionnaireStatus =
  (typeof QuestionnaireStatus)[keyof typeof QuestionnaireStatus];
export const QuestionnaireStatusSchema = z.nativeEnum(QuestionnaireStatus);

// ─── Safety Event Status ─────────────────────────────────────
export const SafetyEventStatus = {
  Draft: "Draft",
  InvestigatorReview: "InvestigatorReview",
  ConfirmedAE: "ConfirmedAE",
  ConfirmedSAE: "ConfirmedSAE",
  Reported: "Reported",
  FollowUp: "FollowUp",
  Closed: "Closed",
} as const;
export type SafetyEventStatus =
  (typeof SafetyEventStatus)[keyof typeof SafetyEventStatus];
export const SafetyEventStatusSchema = z.nativeEnum(SafetyEventStatus);

export const SAFETY_EVENT_TRANSITIONS: Record<
  SafetyEventStatus,
  SafetyEventStatus[]
> = {
  Draft: ["InvestigatorReview"],
  InvestigatorReview: ["ConfirmedAE", "ConfirmedSAE"],
  ConfirmedAE: ["Reported", "FollowUp", "Closed"],
  ConfirmedSAE: ["Reported", "FollowUp", "Closed"],
  Reported: ["FollowUp", "Closed"],
  FollowUp: ["FollowUp", "Closed"],
  Closed: [],
};

/** SAE and high-risk closures require a reason; this helper returns true when
 * a transition into `Closed` is being attempted. Centralized so audit and
 * validation logic agree. */
export const SAFETY_EVENT_CLOSING_STATES: ReadonlyArray<SafetyEventStatus> = [
  SafetyEventStatus.Closed,
];

// ─── Risk Level ──────────────────────────────────────────────
export const RiskLevel = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Critical: "Critical",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
export const RiskLevelSchema = z.nativeEnum(RiskLevel);

/** Severity ordering helper for sorting and threshold checks. Higher number =
 * more severe. */
export const RISK_LEVEL_SEVERITY: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

// ─── Risk Status ─────────────────────────────────────────────
export const RiskStatus = {
  Open: "Open",
  Assigned: "Assigned",
  InProgress: "InProgress",
  PendingInvestigator: "PendingInvestigator",
  Resolved: "Resolved",
  Closed: "Closed",
  Rejected: "Rejected",
} as const;
export type RiskStatus = (typeof RiskStatus)[keyof typeof RiskStatus];
export const RiskStatusSchema = z.nativeEnum(RiskStatus);

export const RISK_STATUS_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  Open: ["Assigned", "Rejected"],
  Assigned: ["InProgress", "Rejected"],
  InProgress: ["PendingInvestigator", "Resolved", "Rejected"],
  PendingInvestigator: ["InProgress", "Resolved", "Rejected"],
  Resolved: ["Closed", "InProgress"],
  Closed: [],
  Rejected: [],
};

// ─── Report Status ───────────────────────────────────────────
export const ReportStatus = {
  Generating: "Generating",
  Draft: "Draft",
  UnderReview: "UnderReview",
  Confirmed: "Confirmed",
  Exported: "Exported",
  Failed: "Failed",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
export const ReportStatusSchema = z.nativeEnum(ReportStatus);

export const REPORT_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  Generating: ["Draft", "Failed"],
  Draft: ["UnderReview", "Failed"],
  UnderReview: ["Confirmed", "Draft"],
  Confirmed: ["Exported"],
  Exported: [],
  Failed: ["Generating"],
};

/**
 * Generic transition guard. Returns true if `to` is reachable from `from`
 * according to the provided transition map. Pure function — does not perform
 * any audit/RBAC checks; those are layered on top.
 */
export function canTransition<S extends string>(
  transitions: Record<S, ReadonlyArray<S>>,
  from: S,
  to: S,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}