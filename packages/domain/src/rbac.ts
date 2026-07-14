/**
 * AIC-DCT Role-Based Access Control (RBAC)
 *
 * Phase 0 establishes the canonical role → permission matrix and the helper
 * functions used by API routes, server actions, and UI guards.
 *
 * IMPORTANT: this file is intentionally dependency-free (no Prisma, no
 * Express) so it can be unit-tested in isolation and reused from any
 * backend/worker/app.
 */
import { Role } from "./enums.js";
import { ApiErrorCode, ApiErrorException } from "./errors.js";
export { Role } from "./enums.js";

// ─── Permission Catalogue ────────────────────────────────────
/**
 * Permission strings are namespaced by domain. New permissions MUST be
 * appended to this list (never inline-string in callers) so the matrix stays
 * auditable.
 */
export const Permission = {
  // Project / Study
  ProjectRead: "project:read",
  ProjectCreate: "project:create",
  ProjectUpdate: "project:update",
  ProjectArchive: "project:archive",
  ProtocolParse: "protocol:parse",
  ProtocolActivate: "protocol:activate",

  // Subject
  SubjectList: "subject:list",
  SubjectReadMasked: "subject:read.masked",
  SubjectReadFull: "subject:read.full",
  SubjectCreate: "subject:create",
  SubjectUpdateStatus: "subject:update.status",
  SubjectWithdraw: "subject:withdraw",
  SubjectTasksRead: "subject:tasks.read",

  // Consent
  ConsentRead: "consent:read",
  ConsentSign: "consent:sign",
  ConsentReConsent: "consent:re-consent",

  // Visit
  VisitRead: "visit:read",
  VisitCreate: "visit:create",
  VisitUpdate: "visit:update",
  VisitSubmit: "visit:submit",
  VisitClose: "visit:close",

  // Questionnaire (ePRO/eCOA)
  QuestionnaireRead: "questionnaire:read",
  QuestionnaireSubmit: "questionnaire:submit",
  QuestionnaireAssistedEntry: "questionnaire:assisted-entry",
  QuestionnaireReview: "questionnaire:review",

  // Safety
  SafetyRead: "safety:read",
  SafetyDraft: "safety:draft",
  SafetyConfirm: "safety:confirm",
  SafetyReport: "safety:report",
  SafetyClose: "safety:close",
  SymptomReport: "symptom:report",

  // Risk
  RiskRead: "risk:read",
  RiskAssign: "risk:assign",
  RiskResolve: "risk:resolve",
  RiskClose: "risk:close",

  // Drug / sample
  DrugRead: "drug:read",
  DrugDispatch: "drug:dispatch",
  DrugReceive: "drug:receive",
  SampleRead: "sample:read",
  SampleCollect: "sample:collect",
  SampleTransfer: "sample:transfer",

  // Report
  ReportRead: "report:read",
  ReportGenerate: "report:generate",
  ReportConfirm: "report:confirm",
  ReportExport: "report:export",

  // Document
  DocumentRead: "document:read",
  DocumentUpload: "document:upload",
  DocumentVersion: "document:version",

  // AI
  AIConfigRead: "ai:config.read",
  AIConfigUpdate: "ai:config.update",
  AIOutputRead: "ai:output.read",
  AIOutputAdopt: "ai:output.adopt",
  AIOutputReject: "ai:output.reject",

  // Audit
  AuditRead: "audit:read",
  AuditExport: "audit:export",

  // System
  UserManage: "user:manage",
  SettingsRead: "settings:read",
  SettingsUpdate: "settings:update",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_VALUES: ReadonlyArray<Permission> = Object.values(
  Permission,
) as Permission[];

// ─── Role → Permission Matrix ────────────────────────────────
/**
 * RBAC matrix. Each role lists the permissions it directly grants. The
 * SystemAdmin role is treated as a superset in {@link rolePermissions}.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  // Sponsor / CRO — portfolio and study oversight
  [Role.SponsorAdmin]: [
    Permission.ProjectRead,
    Permission.ProtocolParse,
    Permission.ProjectCreate,
    Permission.ProjectUpdate,
    Permission.ProjectArchive,
    Permission.ProtocolActivate,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.ConsentRead,
    Permission.VisitRead,
    Permission.QuestionnaireRead,
    Permission.SafetyRead,
    Permission.RiskRead,
    Permission.RiskAssign,
    Permission.RiskResolve,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.ReportGenerate,
    Permission.ReportConfirm,
    Permission.ReportExport,
    Permission.DocumentRead,
    Permission.DocumentUpload,
    Permission.DocumentVersion,
    Permission.AIConfigRead,
    Permission.AIConfigUpdate,
    Permission.AIOutputRead,
    Permission.AIOutputAdopt,
    Permission.AIOutputReject,
    Permission.AuditRead,
    Permission.AuditExport,
    Permission.SettingsRead,
    Permission.UserManage,
  ],
  [Role.CROPM]: [
    Permission.ProjectRead,
    Permission.ProtocolParse,
    Permission.ProjectUpdate,
    Permission.ProtocolActivate,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.ConsentRead,
    Permission.VisitRead,
    Permission.QuestionnaireRead,
    Permission.SafetyRead,
    Permission.RiskRead,
    Permission.RiskAssign,
    Permission.RiskResolve,
    Permission.RiskClose,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.ReportGenerate,
    Permission.ReportConfirm,
    Permission.ReportExport,
    Permission.DocumentRead,
    Permission.DocumentUpload,
    Permission.DocumentVersion,
    Permission.AIConfigRead,
    Permission.AIConfigUpdate,
    Permission.AIOutputRead,
    Permission.AIOutputAdopt,
    Permission.AIOutputReject,
    Permission.AuditRead,
  ],

  // Site staff — operational care for subjects
  [Role.SitePI]: [
    Permission.ProjectRead,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.SubjectCreate,
    Permission.SubjectUpdateStatus,
    Permission.SubjectWithdraw,
    Permission.ConsentRead,
    Permission.ConsentSign,
    Permission.ConsentReConsent,
    Permission.VisitRead,
    Permission.VisitCreate,
    Permission.VisitUpdate,
    Permission.VisitSubmit,
    Permission.VisitClose,
    Permission.QuestionnaireRead,
    Permission.QuestionnaireReview,
    Permission.SafetyRead,
    Permission.SafetyDraft,
    Permission.SafetyConfirm,
    Permission.SafetyReport,
    Permission.SafetyClose,
    Permission.RiskRead,
    Permission.RiskAssign,
    Permission.RiskResolve,
    Permission.DrugRead,
    Permission.DrugDispatch,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.DocumentRead,
    Permission.DocumentUpload,
    Permission.DocumentVersion,
    Permission.AIOutputRead,
    Permission.AIOutputAdopt,
    Permission.AIOutputReject,
    Permission.AuditRead,
  ],
  [Role.SiteCRC]: [
    Permission.ProjectRead,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectCreate,
    Permission.SubjectUpdateStatus,
    Permission.ConsentRead,
    Permission.ConsentSign,
    Permission.VisitRead,
    Permission.VisitCreate,
    Permission.VisitUpdate,
    Permission.VisitSubmit,
    Permission.QuestionnaireRead,
    Permission.QuestionnaireAssistedEntry,
    Permission.SafetyRead,
    Permission.SafetyDraft,
    Permission.RiskRead,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.DocumentRead,
    Permission.AIOutputRead,
  ],

  // CRA — monitoring and source data verification
  [Role.CRA]: [
    Permission.ProjectRead,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.ConsentRead,
    Permission.VisitRead,
    Permission.QuestionnaireRead,
    Permission.SafetyRead,
    Permission.RiskRead,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.DocumentRead,
    Permission.AuditRead,
  ],

  // Read-only audit & regulator roles MUST NOT hold any mutation
  // permissions. They may read sensitive PII and audit trails.
  [Role.Auditor]: [
    Permission.ProjectRead,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.ConsentRead,
    Permission.VisitRead,
    Permission.QuestionnaireRead,
    Permission.SafetyRead,
    Permission.RiskRead,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.DocumentRead,
    Permission.AIConfigRead,
    Permission.AIOutputRead,
    Permission.AuditRead,
    Permission.AuditExport,
  ],
  [Role.RegulatorReadOnly]: [
    Permission.ProjectRead,
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.SubjectReadFull,
    Permission.ConsentRead,
    Permission.VisitRead,
    Permission.QuestionnaireRead,
    Permission.SafetyRead,
    Permission.RiskRead,
    Permission.DrugRead,
    Permission.SampleRead,
    Permission.ReportRead,
    Permission.DocumentRead,
    Permission.AIOutputRead,
    Permission.AuditRead,
  ],

  // Subject mobile — minimal self-service view (self-scoped server-side)
  [Role.Subject]: [
    Permission.SubjectReadMasked,
    Permission.SubjectTasksRead,
    Permission.ConsentRead,
    Permission.ConsentSign,
    Permission.QuestionnaireRead,
    Permission.QuestionnaireSubmit,
    Permission.SymptomReport,
  ],

  // Providers — narrow operational surfaces
  [Role.ProviderLogistics]: [
    Permission.DrugRead,
    Permission.DrugDispatch,
    Permission.DrugReceive,
    Permission.SampleRead,
    Permission.SampleTransfer,
  ],
  [Role.ProviderNurse]: [
    Permission.SubjectList,
    Permission.SubjectReadMasked,
    Permission.VisitRead,
    Permission.SafetyDraft,
    Permission.SampleRead,
    Permission.SampleCollect,
    Permission.DocumentRead,
  ],

  // SystemAdmin — everything except audit export restrictions stay open.
  [Role.SystemAdmin]: PERMISSION_VALUES,
};

// ─── Helpers ────────────────────────────────────────────────

export function rolePermissions(role: Role): ReadonlyArray<Permission> {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, perm: Permission): boolean {
  return rolePermissions(role).includes(perm);
}

export interface Actor {
  userId: string;
  role: Role;
  /** Optional scope for project/site membership; Phase 1 will fully use this. */
  projectIds?: ReadonlyArray<string>;
}

export class AuthorizationError extends ApiErrorException {
  constructor(message: string, options: { requestId?: string; details?: Record<string, unknown> } = {}) {
    super(ApiErrorCode.FORBIDDEN, message, options);
    this.name = "AuthorizationError";
  }
}

/**
 * Authorize an action. Throws AuthorizationError if the actor's role lacks the
 * requested permission. The function never silently downgrades — the API
 * caller must decide whether to deny or to ask for confirmation.
 */
export function authorize(
  actor: Actor,
  permission: Permission,
  opts: { requestId?: string; details?: Record<string, unknown> } = {},
): void {
  if (!roleHasPermission(actor.role, permission)) {
    throw new AuthorizationError(
      `Role '${actor.role}' lacks required permission '${permission}'.`,
      {
        requestId: opts.requestId,
        details: { permission, ...(opts.details ?? {}) },
      },
    );
  }
}

/** Convenience: assert and return void; provided for readability in callers. */
export const requirePermission = authorize;

/**
 * Sensitive PII access check. Phase 0 defines the rule; later phases wire
 * field-level redaction. Returns true when the actor may unmask.
 */
export function canViewFullSubjectIdentity(role: Role): boolean {
  return roleHasPermission(role, Permission.SubjectReadFull);
}

/**
 * Read-only roles must never reach a mutation path. Used by API layer to
 * reject any write request from Auditor/RegulatorReadOnly.
 */
export function isReadOnlyRole(role: Role): boolean {
  return role === Role.Auditor || role === Role.RegulatorReadOnly;
}

/** Assert the role can mutate (i.e. is not a read-only role). */
export function assertCanMutate(role: Role, requestId?: string): void {
  if (isReadOnlyRole(role)) {
    throw new AuthorizationError(
      `Role '${role}' is read-only and cannot perform mutations.`,
      { requestId, details: { role } },
    );
  }
}