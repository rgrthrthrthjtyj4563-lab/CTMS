/**
 * AIC-DCT AI Output Lifecycle
 *
 * Every AI-generated suggestion must go through the lifecycle defined here
 * before it can become a formal clinical or operational record. This module
 * is the single source of truth for transitions and validation.
 */
import { z } from "zod";
import { HumanConfirmationStatus } from "./enums.js";
import { ApiErrorCode, ApiErrorException } from "./errors.js";

// ─── AI Output Type Catalogue ───────────────────────────────
export const AIOutputKind = {
  ProtocolParse: "ProtocolParse",
  ProtocolField: "ProtocolField",
  VisitSchedule: "VisitSchedule",
  ConsentSummary: "ConsentSummary",
  RiskSignal: "RiskSignal",
  SafetySuggestion: "SafetySuggestion",
  EPROAnomaly: "EPROAnomaly",
  ReportDraft: "ReportDraft",
  DocumentSummary: "DocumentSummary",
} as const;
export type AIOutputKind = (typeof AIOutputKind)[keyof typeof AIOutputKind];
export const AIOutputKindSchema = z.nativeEnum(AIOutputKind);

// ─── Confidence Expression ──────────────────────────────────
export const ConfidenceLevel = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
} as const;
export type ConfidenceLevel =
  (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];
export const ConfidenceLevelSchema = z.nativeEnum(ConfidenceLevel);

export const AISourceSchema = z.object({
  model: z.string().min(1),
  modelVersion: z.string().min(1),
  promptTemplateId: z.string().min(1),
  promptVersion: z.string().min(1),
  knowledgeBaseRefs: z.array(z.string()).default([]),
  inputHash: z.string().min(1),
  rawRequest: z.unknown().optional(),
  rawResponse: z.unknown().optional(),
});
export type AISource = z.infer<typeof AISourceSchema>;

// ─── AI Output Schema ───────────────────────────────────────
export const AIOutputSchema = z.object({
  id: z.string().optional(),
  kind: AIOutputKindSchema,
  projectId: z.string().min(1),
  subjectId: z.string().optional(),
  /** Free-form structured payload (e.g. parsed protocol field, risk signal). */
  payload: z.unknown(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: ConfidenceLevelSchema,
  source: AISourceSchema,
  generatedAt: z.date(),
  status: z.nativeEnum(HumanConfirmationStatus).default(HumanConfirmationStatus.Pending),
  /** When status becomes Adopted/EditedAdopted/Rejected. */
  confirmedByUserId: z.string().optional(),
  confirmedAt: z.date().optional(),
  confirmationNotes: z.string().max(2000).optional(),
  /** Optional reason required when status moves to Rejected. */
  rejectionReason: z.string().max(2000).optional(),
  /** Audit event IDs that record lifecycle changes. */
  auditEventIds: z.array(z.string()).default([]),
});
export type AIOutput = z.infer<typeof AIOutputSchema>;

// ─── Transitions ────────────────────────────────────────────
export const AI_OUTPUT_TRANSITIONS: Record<
  HumanConfirmationStatus,
  HumanConfirmationStatus[]
> = {
  [HumanConfirmationStatus.Pending]: [
    HumanConfirmationStatus.Adopted,
    HumanConfirmationStatus.EditedAdopted,
    HumanConfirmationStatus.Rejected,
    HumanConfirmationStatus.NeedsInvestigatorConfirmation,
  ],
  [HumanConfirmationStatus.NeedsInvestigatorConfirmation]: [
    HumanConfirmationStatus.Adopted,
    HumanConfirmationStatus.EditedAdopted,
    HumanConfirmationStatus.Rejected,
  ],
  [HumanConfirmationStatus.Adopted]: [],
  [HumanConfirmationStatus.EditedAdopted]: [],
  [HumanConfirmationStatus.Rejected]: [],
};

/**
 * Apply a transition to an AI output. Enforces:
 *   - legal lifecycle transitions
 *   - non-empty actor user id
 *   - mandatory reason when moving to Rejected
 *
 * Returns the updated AIOutput. Throws ApiErrorException on illegal
 * transitions.
 */
export function applyAIConfirmation(
  output: AIOutput,
  next: HumanConfirmationStatus,
  actor: { userId: string },
  options: { notes?: string; reason?: string } = {},
): AIOutput {
  if (!actor.userId) {
    throw new ApiErrorException(
      ApiErrorCode.UNAUTHORIZED,
      "AI confirmation requires an authenticated user id.",
      { details: { next } },
    );
  }

  const allowed = AI_OUTPUT_TRANSITIONS[output.status] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiErrorException(
      ApiErrorCode.STATE_TRANSITION_INVALID,
      `Illegal AI output transition ${output.status} -> ${next}.`,
      { details: { from: output.status, to: next } },
    );
  }

  if (next === HumanConfirmationStatus.Rejected && !options.reason?.trim()) {
    throw new ApiErrorException(
      ApiErrorCode.REASON_REQUIRED,
      "Rejecting an AI output requires a non-empty reason.",
      { details: { id: output.id ?? "(new)" } },
    );
  }

  return {
    ...output,
    status: next,
    confirmedByUserId: actor.userId,
    confirmedAt: new Date(),
    confirmationNotes: options.notes ?? output.confirmationNotes,
    rejectionReason:
      next === HumanConfirmationStatus.Rejected
        ? options.reason ?? output.rejectionReason
        : output.rejectionReason,
  };
}

/**
 * Whether an AI output may be promoted into a formal clinical record.
 * Per architecture rules, AI must NEVER produce medical finality; only
 * Adopted or EditedAdopted outputs may be referenced by downstream
 * workflows, and only with the explicit AI label still attached.
 */
export function canPromoteAIOutput(output: AIOutput): boolean {
  return (
    output.status === HumanConfirmationStatus.Adopted ||
    output.status === HumanConfirmationStatus.EditedAdopted
  );
}

/**
 * Confidence expression helper. UI should display `formatConfidence` rather
 * than raw floats. Returns a labelled, non-medical phrase.
 */
export function formatConfidence(confidence: number): {
  level: ConfidenceLevel;
  label: string;
} {
  if (confidence >= 0.8) {
    return { level: ConfidenceLevel.High, label: "高置信度（仅供参考，需人工复核）" };
  }
  if (confidence >= 0.5) {
    return { level: ConfidenceLevel.Medium, label: "中等置信度（建议复核）" };
  }
  return { level: ConfidenceLevel.Low, label: "低置信度（必须人工复核）" };
}