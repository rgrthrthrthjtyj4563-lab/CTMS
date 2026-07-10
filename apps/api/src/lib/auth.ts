/**
 * Cross-cutting server-side helpers for Phase 2 clinical workflows.
 */
import type { FastifyRequest } from "fastify";
import {
  ApiErrorCode,
  ApiErrorException,
  Role,
  type SubjectStatus as SubjectStatusT,
  type ConsentStatus as ConsentStatusT,
  type VisitStatus as VisitStatusT,
  type QuestionnaireStatus as QuestionnaireStatusT,
  canTransition,
  SUBJECT_STATUS_TRANSITIONS,
  CONSENT_STATUS_TRANSITIONS,
  VISIT_STATUS_TRANSITIONS,
  QUESTIONNAIRE_STATUS_TRANSITIONS,
  AuditObjectType,
  criticalActionMeta,
} from "@aic-dct/domain";
import { prisma } from "../db.js";

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
  projectIdSource: "roleAssignment" | "query";
}

export async function requireUser(req: FastifyRequest): Promise<AuthenticatedUser> {
  const userId = readHeader(req, "x-actor-id");
  if (!userId) {
    throw new ApiErrorException(ApiErrorCode.UNAUTHORIZED, "Missing X-Actor-Id", { requestId: req.id });
  }
  const user = await prisma().user.findUnique({
    where: { id: userId },
    include: { roleAssignments: { orderBy: { assignedAt: "asc" }, take: 1 } },
  });
  if (!user || user.roleAssignments.length === 0) {
    throw new ApiErrorException(ApiErrorCode.UNAUTHORIZED, "Unknown or unassigned user", { requestId: req.id });
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

/**
 * Persist an audit event. Phase 3 hardening:
 * - Writes beforeValue so audit chain is reconstructible.
 * - For (objectType, action) pairs in CRITICAL_AUDIT_PAIRS with requiresReason,
 *   throws REASON_REQUIRED when reason is empty.
 */
export async function audit(
  req: FastifyRequest,
  user: AuthenticatedUser,
  action: string,
  objectType: string,
  objectId: string,
  details: Record<string, unknown> = {},
  options: { beforeValue?: unknown; reason?: string } = {},
): Promise<void> {
  const meta = criticalActionMeta(
    objectType as AuditObjectType,
    action as Parameters<typeof criticalActionMeta>[1],
  );
  if (meta?.requiresReason) {
    if (!options.reason || options.reason.trim().length === 0) {
      throw new ApiErrorException(
        ApiErrorCode.REASON_REQUIRED,
        `Audit event for ${objectType}.${action} requires a non-empty reason.`,
        { requestId: req.id, details: { objectType, action } },
      );
    }
  }
  await prisma().auditEvent.create({
    data: {
      projectId: user.projectId,
      actorUserId: user.userId,
      actorRole: user.role,
      action,
      objectType,
      objectId,
      beforeValue: (options.beforeValue ?? null) as object,
      afterValue: details as object,
      reason: options.reason ?? null,
      requestId: req.id,
    },
  });
}

export function assertSubjectTransition(from: SubjectStatusT, to: SubjectStatusT): void {
  if (from === to) return;
  if (!canTransition(SUBJECT_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal subject status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertConsentTransition(from: ConsentStatusT, to: ConsentStatusT): void {
  if (from === to) return;
  if (!canTransition(CONSENT_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal consent status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertVisitTransition(from: VisitStatusT, to: VisitStatusT): void {
  if (from === to) return;
  if (!canTransition(VISIT_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal visit status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}

export function assertQuestionnaireTransition(from: QuestionnaireStatusT, to: QuestionnaireStatusT): void {
  if (from === to) return;
  if (!canTransition(QUESTIONNAIRE_STATUS_TRANSITIONS, from, to)) {
    throw new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      `Illegal questionnaire status transition: ${from} → ${to}`,
      { details: { from, to } },
    );
  }
}