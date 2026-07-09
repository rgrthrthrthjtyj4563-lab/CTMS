/**
 * Shared domain Zod schemas used by API route validators and Prisma seed
 * scripts. Names follow the architecture roadmap.
 */
import { z } from "zod";
import {
  ConsentStatus,
  HumanConfirmationStatus,
  ProtocolParseStatus,
  QuestionnaireStatus,
  RiskLevel,
  RiskStatus,
  SafetyEventStatus,
  SubjectStatus,
  VisitStatus,
  ReportStatus,
} from "./enums.js";
import { ConfidenceLevel } from "./ai.js";

// ─── Project / Site ─────────────────────────────────────────
export const ProjectSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  sponsor: z.string().min(1).max(200),
  therapeuticArea: z.string().min(1).max(200),
  phase: z.enum(["I", "II", "III", "IV"]),
  description: z.string().max(2000).optional(),
  startDate: z.date(),
  estimatedEndDate: z.date().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const SiteSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  principalInvestigatorUserId: z.string().min(1).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});
export type Site = z.infer<typeof SiteSchema>;

// ─── User / Role assignment ─────────────────────────────────
export const UserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  phone: z.string().max(32).optional(),
  organization: z.string().max(200).optional(),
  active: z.boolean().default(true),
});
export type User = z.infer<typeof UserSchema>;

export const RoleAssignmentSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  role: z.string().min(1),
  assignedAt: z.date().default(() => new Date()),
});
export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

// ─── Subject ────────────────────────────────────────────────
export const MaskedIdentitySchema = z.object({
  /** Site-side identifier shown in lists; safe by default. */
  subjectCode: z.string().min(1).max(64),
  initials: z.string().max(8).optional(),
  yearOfBirth: z.number().int().min(1900).max(2100).optional(),
  ageBand: z.string().max(32).optional(),
  sex: z.enum(["Male", "Female", "Other", "Unknown"]).optional(),
  city: z.string().max(100).optional(),
});
export type MaskedIdentity = z.infer<typeof MaskedIdentitySchema>;

export const SensitiveIdentitySchema = z.object({
  fullName: z.string().min(1).max(200),
  nationalId: z.string().min(1).max(64),
  dateOfBirth: z.date(),
  phone: z.string().min(1).max(32),
  email: z.string().email(),
  address: z.string().max(500),
});
export type SensitiveIdentity = z.infer<typeof SensitiveIdentitySchema>;

export const SubjectSchema = z.object({
  projectId: z.string().min(1),
  siteId: z.string().min(1),
  status: z.nativeEnum(SubjectStatus),
  masked: MaskedIdentitySchema,
  sensitive: SensitiveIdentitySchema.optional(), // never returned in default API
  enrollmentDate: z.date().optional(),
  withdrawnDate: z.date().optional(),
});
export type Subject = z.infer<typeof SubjectSchema>;

// ─── Protocol ───────────────────────────────────────────────
export const ProtocolVersionSchema = z.object({
  projectId: z.string().min(1),
  version: z.string().min(1).max(64),
  effectiveFrom: z.date().optional(),
  supersededAt: z.date().optional(),
  documentUrl: z.string().url(),
  parseStatus: z.nativeEnum(ProtocolParseStatus),
});
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

export const AIProtocolParseResultSchema = z.object({
  protocolVersionId: z.string().min(1),
  generatedAt: z.date(),
  status: z.nativeEnum(HumanConfirmationStatus).default(HumanConfirmationStatus.Pending),
  fields: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.nativeEnum(ConfidenceLevel),
  aiOutputId: z.string().optional(),
});
export type AIProtocolParseResult = z.infer<typeof AIProtocolParseResultSchema>;

// ─── Consent ────────────────────────────────────────────────
export const ConsentDocumentSchema = z.object({
  projectId: z.string().min(1),
  version: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  documentUrl: z.string().url(),
  effectiveFrom: z.date(),
});
export type ConsentDocument = z.infer<typeof ConsentDocumentSchema>;

export const ConsentTaskSchema = z.object({
  subjectId: z.string().min(1),
  consentDocumentId: z.string().min(1),
  status: z.nativeEnum(ConsentStatus),
  startedAt: z.date().optional(),
  comprehensionScore: z.number().min(0).max(1).optional(),
  completedAt: z.date().optional(),
});
export type ConsentTask = z.infer<typeof ConsentTaskSchema>;

export const SignatureRecordSchema = z.object({
  consentTaskId: z.string().min(1),
  signerUserId: z.string().min(1),
  signerRole: z.enum(["Subject", "Investigator", "Witness"]),
  signedAt: z.date(),
  signatureMethod: z.enum(["ESign", "WetInk", "Biometric"]),
  signaturePayload: z.string(),
  ipAddress: z.string().optional(),
});
export type SignatureRecord = z.infer<typeof SignatureRecordSchema>;

// ─── Visit ──────────────────────────────────────────────────
export const VisitSchema = z.object({
  subjectId: z.string().min(1),
  visitCode: z.string().min(1).max(32),
  scheduledAt: z.date(),
  windowStart: z.date(),
  windowEnd: z.date(),
  status: z.nativeEnum(VisitStatus),
});
export type Visit = z.infer<typeof VisitSchema>;

export const VisitTaskSchema = z.object({
  visitId: z.string().min(1),
  code: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  completed: z.boolean().default(false),
});
export type VisitTask = z.infer<typeof VisitTaskSchema>;

export const RemoteVisitRecordSchema = z.object({
  visitId: z.string().min(1),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  videoProvider: z.string().optional(),
  videoSessionId: z.string().optional(),
  notes: z.string().max(5000).optional(),
});
export type RemoteVisitRecord = z.infer<typeof RemoteVisitRecordSchema>;

// ─── Questionnaire (ePRO/eCOA) ──────────────────────────────
export const QuestionnaireTemplateSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(32),
  schema: z.record(z.unknown()),
});
export type QuestionnaireTemplate = z.infer<typeof QuestionnaireTemplateSchema>;

export const QuestionnaireResponseSchema = z.object({
  questionnaireTemplateId: z.string().min(1),
  subjectId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  status: z.nativeEnum(QuestionnaireStatus),
  responses: z.record(z.unknown()),
  submittedAt: z.date().optional(),
});
export type QuestionnaireResponse = z.infer<typeof QuestionnaireResponseSchema>;

// ─── Safety ─────────────────────────────────────────────────
export const SafetyEventSchema = z.object({
  subjectId: z.string().min(1),
  projectId: z.string().min(1),
  onsetAt: z.date(),
  description: z.string().min(1).max(5000),
  severity: z.nativeEnum(RiskLevel),
  status: z.nativeEnum(SafetyEventStatus),
  isSerious: z.boolean().default(false),
  aiSuggested: z.boolean().default(false),
  aiOutputId: z.string().optional(),
});
export type SafetyEvent = z.infer<typeof SafetyEventSchema>;

export const SafetyFollowUpSchema = z.object({
  safetyEventId: z.string().min(1),
  followUpAt: z.date(),
  outcome: z.string().min(1).max(5000),
  recordedByUserId: z.string().min(1),
});
export type SafetyFollowUp = z.infer<typeof SafetyFollowUpSchema>;

// ─── Risk ───────────────────────────────────────────────────
export const RiskSignalSchema = z.object({
  projectId: z.string().min(1),
  level: z.nativeEnum(RiskLevel),
  type: z.string().min(1).max(64),
  objectType: z.string().min(1).max(64),
  objectId: z.string().min(1),
  trigger: z.string().min(1).max(1000),
  suggestion: z.string().max(2000).optional(),
  ownerUserId: z.string().min(1).optional(),
  deadline: z.date().optional(),
  status: z.nativeEnum(RiskStatus),
  aiOutputId: z.string().optional(),
});
export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const RiskHandlingRecordSchema = z.object({
  riskSignalId: z.string().min(1),
  actorUserId: z.string().min(1),
  action: z.enum(["Assign", "Comment", "Resolve", "Close", "Reject", "Reopen"]),
  fromStatus: z.nativeEnum(RiskStatus),
  toStatus: z.nativeEnum(RiskStatus),
  reason: z.string().max(2000).optional(),
  at: z.date(),
});
export type RiskHandlingRecord = z.infer<typeof RiskHandlingRecordSchema>;

// ─── Drug / sample ──────────────────────────────────────────
export const DrugShipmentSchema = z.object({
  projectId: z.string().min(1),
  siteId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  batchNumber: z.string().min(1).max(64),
  dispatchedAt: z.date(),
  receivedAt: z.date().optional(),
  temperatureLog: z.array(
    z.object({
      at: z.date(),
      temperatureC: z.number(),
      location: z.string().optional(),
    }),
  ),
});
export type DrugShipment = z.infer<typeof DrugShipmentSchema>;

export const SampleTransferSchema = z.object({
  projectId: z.string().min(1),
  subjectId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  sampleType: z.string().min(1).max(64),
  collectedAt: z.date().optional(),
  transferredAt: z.date().optional(),
  status: z.enum(["Pending", "Collected", "InTransit", "Received", "Rejected"]),
});
export type SampleTransfer = z.infer<typeof SampleTransferSchema>;

// ─── Report / Document ──────────────────────────────────────
export const ReportDraftSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["Interim", "Final", "Safety", "Custom"]),
  status: z.nativeEnum(ReportStatus),
  generatedAt: z.date(),
  confirmedAt: z.date().optional(),
  sourceSnapshotId: z.string().min(1).optional(),
});
export type ReportDraft = z.infer<typeof ReportDraftSchema>;

export const ExportRecordSchema = z.object({
  projectId: z.string().min(1),
  objectType: z.string().min(1).max(64),
  objectIds: z.array(z.string().min(1)).min(1),
  format: z.enum(["CSV", "PDF", "XLSX", "JSON"]),
  reason: z.string().min(1).max(2000),
  exportedByUserId: z.string().min(1),
  exportedAt: z.date(),
});
export type ExportRecord = z.infer<typeof ExportRecordSchema>;

export const DocumentSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  category: z.enum(["Protocol", "ICF", "Manual", "Report", "Other"]),
  currentVersionId: z.string().optional(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentVersionSchema = z.object({
  documentId: z.string().min(1),
  version: z.string().min(1).max(32),
  fileUrl: z.string().url(),
  uploadedByUserId: z.string().min(1),
  uploadedAt: z.date(),
  sha256: z.string().min(64).max(64),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

// ─── AI Platform ────────────────────────────────────────────
export const AIConfigSchema = z.object({
  projectId: z.string().min(1).optional(),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().optional(),
  enabled: z.boolean().default(true),
});
export type AIConfig = z.infer<typeof AIConfigSchema>;

export const PromptTemplateSchema = z.object({
  code: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
  outputKind: z.enum([
    "ProtocolParse",
    "ProtocolField",
    "VisitSchedule",
    "ConsentSummary",
    "RiskSignal",
    "SafetySuggestion",
    "EPROAnomaly",
    "ReportDraft",
    "DocumentSummary",
  ]),
  createdAt: z.date(),
});
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const AICallLogSchema = z.object({
  aiOutputId: z.string().optional(),
  promptTemplateId: z.string().min(1),
  model: z.string().min(1),
  inputHash: z.string().min(1),
  startedAt: z.date(),
  finishedAt: z.date().optional(),
  statusCode: z.number().int().optional(),
  errorMessage: z.string().optional(),
});
export type AICallLog = z.infer<typeof AICallLogSchema>;