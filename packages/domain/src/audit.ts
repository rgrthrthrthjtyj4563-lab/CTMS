/**
 * AIC-DCT Audit Trail
 *
 * Defines the audit taxonomy (event categories + actions) and a pure helper
 * for building audit events that downstream backends persist.
 *
 * The DB schema in prisma/schema.prisma mirrors this shape.
 */
import { z } from "zod";
import { ApiErrorCode, ApiErrorException } from "./errors.js";

// ─── Object Types ───────────────────────────────────────────
export const AuditObjectType = {
  Project: "Project",
  ProtocolVersion: "ProtocolVersion",
  Subject: "Subject",
  Consent: "Consent",
  Visit: "Visit",
  QuestionnaireResponse: "QuestionnaireResponse",
  SymptomReport: "SymptomReport",
  SafetyEvent: "SafetyEvent",
  RiskSignal: "RiskSignal",
  DrugShipment: "DrugShipment",
  SampleTransfer: "SampleTransfer",
  ReportDraft: "ReportDraft",
  ExportRecord: "ExportRecord",
  Document: "Document",
  AIConfig: "AIConfig",
  AIOutput: "AIOutput",
  User: "User",
  AuditExport: "AuditExport",
} as const;
export type AuditObjectType =
  (typeof AuditObjectType)[keyof typeof AuditObjectType];
export const AuditObjectTypeSchema = z.nativeEnum(AuditObjectType);

// ─── Action Catalogue ───────────────────────────────────────
/**
 * Every critical mutation MUST use one of these actions. The list is
 * deliberately narrow so that audit reports group cleanly.
 */
export const AuditAction = {
  Create: "create",
  Update: "update",
  Delete: "delete",
  SoftDelete: "soft-delete",

  // Workflow transitions
  StatusChange: "status-change",
  Adopt: "adopt",
  Reject: "reject",
  Confirm: "confirm",
  Sign: "sign",
  Submit: "submit",
  Report: "report",
  Close: "close",
  Reopen: "reopen",

  // Sensitive access
  ViewFullIdentity: "view-full-identity",
  MaskReveal: "mask-reveal",
  Export: "export",

  // Auth & admin
  Login: "login",
  Logout: "logout",
  LoginFailed: "login-failed",
  RoleAssigned: "role-assigned",
  RoleRevoked: "role-revoked",

  // AI lifecycle
  AIOutputGenerated: "ai-output-generated",
  AIOutputAdopted: "ai-output-adopted",
  AIOutputEditedAdopted: "ai-output-edited-adopted",
  AIOutputRejected: "ai-output-rejected",

  // Protocol
  ProtocolUploaded: "protocol-uploaded",
  ProtocolParsed: "protocol-parsed",
  ProtocolActivated: "protocol-activated",
  ProtocolSuperseded: "protocol-superseded",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export const AuditActionSchema = z.nativeEnum(AuditAction);

// ─── Action Metadata ────────────────────────────────────────
/**
 * Whether a given (objectType, action) tuple is considered a critical,
 * audit-required mutation. Critical actions require:
 *   - a server-side authorization check
 *   - a server-side audit event
 *   - confirmation dialog in the UI
 *   - reason field when listed in REQUIRES_REASON
 */
export const CRITICAL_AUDIT_PAIRS: ReadonlyArray<{
  objectType: AuditObjectType;
  action: AuditAction;
  requiresReason?: boolean;
  requiresConfirmation?: boolean;
}> = [
  // Consent
  { objectType: AuditObjectType.Consent, action: AuditAction.Sign, requiresConfirmation: true, requiresReason: false },
  { objectType: AuditObjectType.Consent, action: AuditAction.Reopen, requiresConfirmation: true, requiresReason: true },

  // Safety
  { objectType: AuditObjectType.SafetyEvent, action: AuditAction.Confirm, requiresConfirmation: true },
  { objectType: AuditObjectType.SafetyEvent, action: AuditAction.Report, requiresConfirmation: true, requiresReason: true },
  { objectType: AuditObjectType.SafetyEvent, action: AuditAction.Close, requiresConfirmation: true, requiresReason: true },

  // Risk
  { objectType: AuditObjectType.RiskSignal, action: AuditAction.Confirm, requiresConfirmation: true },
  { objectType: AuditObjectType.RiskSignal, action: AuditAction.Close, requiresConfirmation: true, requiresReason: true },
  { objectType: AuditObjectType.RiskSignal, action: AuditAction.Reject, requiresConfirmation: true, requiresReason: true },

  // ReportDraft
  { objectType: AuditObjectType.ReportDraft, action: AuditAction.Confirm, requiresConfirmation: true },
  { objectType: AuditObjectType.ReportDraft, action: AuditAction.Export, requiresConfirmation: true, requiresReason: true },

  // Sensitive PII
  { objectType: AuditObjectType.Subject, action: AuditAction.ViewFullIdentity, requiresReason: false },
  { objectType: AuditObjectType.Subject, action: AuditAction.MaskReveal, requiresReason: true },

  // Protocol
  { objectType: AuditObjectType.ProtocolVersion, action: AuditAction.ProtocolActivated, requiresConfirmation: true, requiresReason: true },
  { objectType: AuditObjectType.ProtocolVersion, action: AuditAction.ProtocolSuperseded, requiresConfirmation: true, requiresReason: true },

  // AI
  { objectType: AuditObjectType.AIOutput, action: AuditAction.AIOutputAdopted, requiresConfirmation: true },
  { objectType: AuditObjectType.AIOutput, action: AuditAction.AIOutputEditedAdopted, requiresConfirmation: true },
  { objectType: AuditObjectType.AIOutput, action: AuditAction.AIOutputRejected, requiresConfirmation: true, requiresReason: true },

  // Export
  { objectType: AuditObjectType.ExportRecord, action: AuditAction.Export, requiresConfirmation: true, requiresReason: true },
  { objectType: AuditObjectType.AuditExport, action: AuditAction.Export, requiresConfirmation: true, requiresReason: true },
];

export interface CriticalPair {
  objectType: AuditObjectType;
  action: AuditAction;
  requiresReason: boolean;
  requiresConfirmation: boolean;
}

const CRITICAL_PAIR_INDEX = new Map<string, CriticalPair>(
  CRITICAL_AUDIT_PAIRS.map((p) => [
    `${p.objectType}::${p.action}`,
    {
      objectType: p.objectType,
      action: p.action,
      requiresReason: p.requiresReason ?? false,
      requiresConfirmation: p.requiresConfirmation ?? false,
    },
  ]),
);

export function isCriticalAction(
  objectType: AuditObjectType,
  action: AuditAction,
): boolean {
  return CRITICAL_PAIR_INDEX.has(`${objectType}::${action}`);
}

export function criticalActionMeta(
  objectType: AuditObjectType,
  action: AuditAction,
): CriticalPair | undefined {
  return CRITICAL_PAIR_INDEX.get(`${objectType}::${action}`);
}

// ─── Audit Event Schema ─────────────────────────────────────
export const AuditEventSchema = z.object({
  id: z.string().optional(),
  actorUserId: z.string().min(1),
  actorRole: z.string().min(1),
  projectId: z.string().min(1),
  objectType: AuditObjectTypeSchema,
  objectId: z.string().min(1),
  action: AuditActionSchema,
  beforeValue: z.unknown().optional(),
  afterValue: z.unknown().optional(),
  reason: z.string().max(2000).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  device: z.string().optional(),
  requestId: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  requestId?: string;
}

export interface AuditDeps {
  /** Persist a single audit event. Provided by the backend's repository. */
  persist: (event: AuditEvent) => Promise<void>;
  /** Generate stable IDs; defaults to crypto.randomUUID when available. */
  generateId?: () => string;
}

/**
 * Build, validate, and persist an audit event.
 *
 * If the action is critical and requires a reason, this function throws an
 * ApiErrorException with code REASON_REQUIRED — callers MUST supply the
 * reason. This enforces the compliance contract at the helper layer rather
 * than relying on controller discipline.
 */
export async function recordAuditEvent(
  deps: AuditDeps,
  input: Omit<AuditEvent, "timestamp" | "id"> & { timestamp?: Date; id?: string },
): Promise<AuditEvent> {
  const meta = criticalActionMeta(input.objectType, input.action);
  if (meta?.requiresReason && (!input.reason || input.reason.trim().length === 0)) {
    throw new ApiErrorException(
      ApiErrorCode.REASON_REQUIRED,
      `Audit event for ${input.objectType}.${input.action} requires a non-empty reason.`,
      {
        details: { objectType: input.objectType, action: input.action },
        requestId: input.requestId ?? "unknown-request",
      },
    );
  }

  const id = input.id ?? deps.generateId?.() ?? cryptoRandomId();
  const event: AuditEvent = AuditEventSchema.parse({
    ...input,
    id,
    timestamp: input.timestamp ?? new Date(),
  });

  await deps.persist(event);
  return event;
}

function cryptoRandomId(): string {
  // Use global crypto when available; deterministic fallback for environments
  // without it.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}