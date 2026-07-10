/**
 * Cross-cutting server-side helpers for Phase 2 clinical workflows.
 *
 * Phase 1's /api/auth/login is a mock: it returns the user's profile in
 * the response body without writing a session row. The Web app stores
 * the session in localStorage and the dashboard already reads the user
 * back via X-Session-Id-less headers.
 *
 * To keep RBAC honest while not requiring a Phase 2 schema migration,
 * the client sends two headers derived from the localStorage session:
 *   X-Actor-Id        — the user's CUID
 *   X-Actor-Role      — the role claim (the server re-resolves it from
 *                       the database, so the client cannot escalate by
 *                       spoofing this header)
 * The server re-reads the user from Prisma on every request and only
 * trusts the role that came back from the DB.
 */
import type { FastifyRequest } from "fastify";
import {
  ApiErrorCode,
  ApiErrorException,
  Role,
  SubjectStatus,
  type SubjectStatus as SubjectStatusT,
  ConsentStatus,
  type ConsentStatus as ConsentStatusT,
  VisitStatus,
  type VisitStatus as VisitStatusT,
  QuestionnaireStatus,
  type QuestionnaireStatus as QuestionnaireStatusT,
  canTransition,
} from "@aic-dct/domain";
import { prisma } from "../db.js";

/** Roles allowed to unmask a subject's full identity (PII). */
const PII_ALLOWED_ROLES: ReadonlySet<Role> = new Set([
  Role.SitePI,
  Role.SiteCRC,
  Role.SponsorAdmin,
  Role.CROPM,
  Role.SystemAdmin,
]);

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  projectId: string;
  displayName: string;
  /** First role assignment's project — used to scope queries. */
  projectIdSource: "roleAssignment" | "query";
}

/**
 * Resolves the current user from headers, re-reading the user record
 * from the database to confirm the role. Throws 401 if either header
 * is missing or the user no longer exists / has no role assignment.
 */
export async function requireUser(
  req: FastifyRequest,
): Promise<AuthenticatedUser> {
  const userId = readHeader(req, "x-actor-id");
  if (!userId) {
    throw new ApiErrorException(
      ApiErrorCode.UNAUTHORIZED,
      "Missing X-Actor-Id",
      { requestId: req.id },
    );
  }
  const user = await prisma().user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        orderBy: { assignedAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user || user.roleAssignments.length === 0) {
    throw new ApiErrorException(
      ApiErrorCode.UNAUTHORIZED,
      "Unknown or unassigned user",
      { requestId: req.id },
    );
  }
  const assignment = user.roleAssignments[0];
  return {
    userId: user.id,
    role: assignment.role as Role,
    projectId: assignment.projectId ?? "",
    displayName: user.displayName,
    projectIdSource: "roleAssignment",
  };
}

function readHeader(req: FastifyRequest, name: string): string | null {
  const v = req.headers[name];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return null;
}

export function canUnmaskPII(role: Role): boolean {
  return PII_ALLOWED_ROLES.has(role);
}

/* ─── Identity masking helpers ─────────────────────────────────── */

export function maskNationalId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 6) return id;
  return `${id.slice(0, 6)}********${id.slice(-4)}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return email ?? "—";
  const [user, domain] = email.split("@");
  if (user.length <= 1) return `*@${domain}`;
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  if (name.length <= 1) return name;
  return `${name[0]}${"*".repeat(Math.min(3, name.length - 1))}`;
}

/* ─── Audit ────────────────────────────────────────────────────── */

export async function audit(
  req: FastifyRequest,
  user: AuthenticatedUser,
  action: string,
  objectType: string,
  objectId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await prisma().auditEvent.create({
    data: {
      projectId: user.projectId,
      actorUserId: user.userId,
      actorRole: user.role,
      action,
      objectType,
      objectId,
      // Phase 2 AuditEvent has no `details` column. Encode the structured
      // payload as JSON in `afterValue` so the dashboard can still
      // surface a human-readable message after JSON.parse.
      afterValue: details as object,
      requestId: req.id,
    },
  });
}

/* ─── Lifecycle guards ────────────────────────────────────────── */

export function assertSubjectTransition(
  from: SubjectStatusT,
  to: SubjectStatusT,
): void {
  if (from === to) return;
  if (!canTransition(SUBJECT_STATUS_TRANSITIONS_TABLE, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal subject status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertConsentTransition(
  from: ConsentStatusT,
  to: ConsentStatusT,
): void {
  if (from === to) return;
  if (!canTransition(CONSENT_STATUS_TRANSITIONS_TABLE, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal consent status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertVisitTransition(
  from: VisitStatusT,
  to: VisitStatusT,
): void {
  if (from === to) return;
  if (!canTransition(VISIT_STATUS_TRANSITIONS_TABLE, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal visit status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertQuestionnaireTransition(
  from: QuestionnaireStatusT,
  to: QuestionnaireStatusT,
): void {
  if (from === to) return;
  if (!canTransition(QUESTIONNAIRE_STATUS_TRANSITIONS_TABLE, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal questionnaire status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

/* Transition tables — keep in sync with @aic-dct/domain. Duplicated
 * here to avoid widening the public surface of the domain package. */

const SUBJECT_STATUS_TRANSITIONS_TABLE: Record<
  SubjectStatusT,
  ReadonlyArray<SubjectStatusT>
> = {
  [SubjectStatus.PreScreening]: [SubjectStatus.Consenting, SubjectStatus.ScreenFailed, SubjectStatus.Withdrawn],
  [SubjectStatus.Consenting]: [SubjectStatus.Screening, SubjectStatus.Withdrawn, SubjectStatus.ScreenFailed],
  [SubjectStatus.Screening]: [SubjectStatus.Enrolled, SubjectStatus.ScreenFailed, SubjectStatus.Withdrawn],
  [SubjectStatus.Enrolled]: [SubjectStatus.Active, SubjectStatus.Withdrawn, SubjectStatus.ScreenFailed],
  [SubjectStatus.Active]: [SubjectStatus.Completed, SubjectStatus.Withdrawn],
  [SubjectStatus.Completed]: [],
  [SubjectStatus.Withdrawn]: [],
  [SubjectStatus.ScreenFailed]: [],
};

const CONSENT_STATUS_TRANSITIONS_TABLE: Record<
  ConsentStatusT,
  ReadonlyArray<ConsentStatusT>
> = {
  [ConsentStatus.NotStarted]: [ConsentStatus.Reading, ConsentStatus.Withdrawn],
  [ConsentStatus.Reading]: [ConsentStatus.ComprehensionPending, ConsentStatus.Withdrawn],
  [ConsentStatus.ComprehensionPending]: [ConsentStatus.SubjectSigned, ConsentStatus.Reading, ConsentStatus.Withdrawn],
  [ConsentStatus.SubjectSigned]: [ConsentStatus.InvestigatorSigned, ConsentStatus.Withdrawn],
  [ConsentStatus.InvestigatorSigned]: [ConsentStatus.Completed, ConsentStatus.Withdrawn],
  [ConsentStatus.Completed]: [ConsentStatus.ReConsentRequired, ConsentStatus.Withdrawn],
  [ConsentStatus.ReConsentRequired]: [ConsentStatus.Reading, ConsentStatus.Withdrawn],
  [ConsentStatus.Withdrawn]: [],
};

const VISIT_STATUS_TRANSITIONS_TABLE: Record<
  VisitStatusT,
  ReadonlyArray<VisitStatusT>
> = {
  [VisitStatus.NotStarted]: [VisitStatus.Scheduled],
  [VisitStatus.Scheduled]: [VisitStatus.InProgress, VisitStatus.Missed, VisitStatus.OutOfWindow],
  [VisitStatus.InProgress]: [VisitStatus.SubmittedForPI, VisitStatus.Completed, VisitStatus.Deviation],
  [VisitStatus.SubmittedForPI]: [VisitStatus.Completed, VisitStatus.Deviation, VisitStatus.InProgress],
  [VisitStatus.Completed]: [],
  [VisitStatus.Missed]: [VisitStatus.Scheduled, VisitStatus.Deviation],
  [VisitStatus.OutOfWindow]: [VisitStatus.Completed, VisitStatus.Deviation],
  [VisitStatus.Deviation]: [VisitStatus.Completed],
};

const QUESTIONNAIRE_STATUS_TRANSITIONS_TABLE: Record<
  QuestionnaireStatusT,
  ReadonlyArray<QuestionnaireStatusT>
> = {
  [QuestionnaireStatus.Scheduled]: [
    QuestionnaireStatus.InProgress,
    QuestionnaireStatus.Missed,
    QuestionnaireStatus.Late,
  ],
  [QuestionnaireStatus.InProgress]: [
    QuestionnaireStatus.Submitted,
    QuestionnaireStatus.Late,
  ],
  [QuestionnaireStatus.Submitted]: [QuestionnaireStatus.Reviewed],
  [QuestionnaireStatus.Missed]: [],
  [QuestionnaireStatus.Late]: [
    QuestionnaireStatus.InProgress,
    QuestionnaireStatus.Submitted,
  ],
  [QuestionnaireStatus.Reviewed]: [],
};