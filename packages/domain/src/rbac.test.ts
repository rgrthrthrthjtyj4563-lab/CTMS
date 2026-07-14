import { describe, it, expect } from "vitest";
import {
  Role,
  Permission,
  authorize,
  assertCanMutate,
  canViewFullSubjectIdentity,
  isReadOnlyRole,
  roleHasPermission,
  rolePermissions,
  AuthorizationError,
  Actor,
} from "./rbac.js";

function actor(role: Role, userId = "user-1"): Actor {
  return { userId, role };
}

describe("RBAC role permissions", () => {
  it("SystemAdmin has all permissions", () => {
    for (const p of Object.values(Permission)) {
      expect(roleHasPermission(Role.SystemAdmin, p)).toBe(true);
    }
  });

  it("SiteCRC cannot close safety events", () => {
    expect(roleHasPermission(Role.SiteCRC, Permission.SafetyClose)).toBe(false);
  });

  it("SitePI can close safety events", () => {
    expect(roleHasPermission(Role.SitePI, Permission.SafetyClose)).toBe(true);
  });

  it("Auditor cannot mutate", () => {
    expect(roleHasPermission(Role.Auditor, Permission.SubjectUpdateStatus)).toBe(false);
    expect(roleHasPermission(Role.Auditor, Permission.ProjectUpdate)).toBe(false);
  });

  it("RegulatorReadOnly cannot mutate", () => {
    expect(roleHasPermission(Role.RegulatorReadOnly, Permission.SafetyConfirm)).toBe(false);
    expect(roleHasPermission(Role.RegulatorReadOnly, Permission.SubjectWithdraw)).toBe(false);
  });

  it("Subject has minimal mobile self-service permissions only", () => {
    const perms = rolePermissions(Role.Subject);
    expect(perms).toContain(Permission.SubjectReadMasked);
    expect(perms).toContain(Permission.SubjectTasksRead);
    expect(perms).toContain(Permission.QuestionnaireRead);
    expect(perms).toContain(Permission.QuestionnaireSubmit);
    expect(perms).toContain(Permission.SymptomReport);
    expect(perms).not.toContain(Permission.SubjectReadFull);
    expect(perms).not.toContain(Permission.SafetyRead);
    expect(perms).not.toContain(Permission.QuestionnaireReview);
  });

  it("ProviderLogistics only sees drug/sample permissions", () => {
    const perms = rolePermissions(Role.ProviderLogistics);
    expect(perms).toContain(Permission.DrugDispatch);
    expect(perms).toContain(Permission.SampleTransfer);
    expect(perms).not.toContain(Permission.SubjectReadFull);
    expect(perms).not.toContain(Permission.SafetyConfirm);
  });

  it("SiteCRC uses assisted-entry instead of staff questionnaire submit", () => {
    expect(roleHasPermission(Role.SiteCRC, Permission.QuestionnaireAssistedEntry)).toBe(true);
    expect(roleHasPermission(Role.SiteCRC, Permission.QuestionnaireSubmit)).toBe(false);
  });

  it("ProviderNurse cannot dispatch drugs", () => {
    expect(roleHasPermission(Role.ProviderNurse, Permission.DrugDispatch)).toBe(false);
    expect(roleHasPermission(Role.ProviderNurse, Permission.SampleCollect)).toBe(true);
  });

  it("ProtocolParse is granted to sponsor/CRO roles, not site staff", () => {
    expect(roleHasPermission(Role.SponsorAdmin, Permission.ProtocolParse)).toBe(true);
    expect(roleHasPermission(Role.CROPM, Permission.ProtocolParse)).toBe(true);
    expect(roleHasPermission(Role.SitePI, Permission.ProtocolParse)).toBe(false);
  });

  // C3 (architect review): assert the Phase 3.5 DocumentUpload /
  // DocumentVersion matrix matches docs/domain/rbac-matrix.md.
  it("DocumentUpload is granted to Sponsor/CROPM/SitePI only", () => {
    expect(roleHasPermission(Role.SponsorAdmin, Permission.DocumentUpload)).toBe(true);
    expect(roleHasPermission(Role.CROPM, Permission.DocumentUpload)).toBe(true);
    expect(roleHasPermission(Role.SitePI, Permission.DocumentUpload)).toBe(true);
    expect(roleHasPermission(Role.SiteCRC, Permission.DocumentUpload)).toBe(false);
    expect(roleHasPermission(Role.CRA, Permission.DocumentUpload)).toBe(false);
    expect(roleHasPermission(Role.Auditor, Permission.DocumentUpload)).toBe(false);
    expect(roleHasPermission(Role.RegulatorReadOnly, Permission.DocumentUpload)).toBe(false);
  });

  it("DocumentVersion is granted to Sponsor/CROPM/SitePI only", () => {
    expect(roleHasPermission(Role.SponsorAdmin, Permission.DocumentVersion)).toBe(true);
    expect(roleHasPermission(Role.CROPM, Permission.DocumentVersion)).toBe(true);
    expect(roleHasPermission(Role.SitePI, Permission.DocumentVersion)).toBe(true);
    expect(roleHasPermission(Role.SiteCRC, Permission.DocumentVersion)).toBe(false);
    expect(roleHasPermission(Role.CRA, Permission.DocumentVersion)).toBe(false);
    expect(roleHasPermission(Role.Auditor, Permission.DocumentVersion)).toBe(false);
  });

  it("DocumentRead remains granted to read-only roles (Auditor/Regulator)", () => {
    expect(roleHasPermission(Role.Auditor, Permission.DocumentRead)).toBe(true);
    expect(roleHasPermission(Role.RegulatorReadOnly, Permission.DocumentRead)).toBe(true);
  });

  // P0 contract sync (Task 3.6): AIConfigUpdate is granted to Sponsor / CRO /
  // System only; site staff and auditors must NOT update AI configs.
  it("AIConfigUpdate is granted to Sponsor/CROPM/SystemAdmin only", () => {
    expect(roleHasPermission(Role.SponsorAdmin, Permission.AIConfigUpdate)).toBe(true);
    expect(roleHasPermission(Role.CROPM, Permission.AIConfigUpdate)).toBe(true);
    expect(roleHasPermission(Role.SystemAdmin, Permission.AIConfigUpdate)).toBe(true);
    expect(roleHasPermission(Role.SitePI, Permission.AIConfigUpdate)).toBe(false);
    expect(roleHasPermission(Role.SiteCRC, Permission.AIConfigUpdate)).toBe(false);
    expect(roleHasPermission(Role.CRA, Permission.AIConfigUpdate)).toBe(false);
    expect(roleHasPermission(Role.Auditor, Permission.AIConfigUpdate)).toBe(false);
    expect(roleHasPermission(Role.RegulatorReadOnly, Permission.AIConfigUpdate)).toBe(false);
  });
});

describe("authorize", () => {
  it("passes when role has permission", () => {
    expect(() =>
      authorize(actor(Role.SitePI), Permission.SafetyClose, { requestId: "r-1" }),
    ).not.toThrow();
  });

  it("throws AuthorizationError when role lacks permission", () => {
    expect(() =>
      authorize(actor(Role.SiteCRC), Permission.SafetyClose, { requestId: "r-2" }),
    ).toThrowError(AuthorizationError);
  });
});

describe("Sensitive PII access", () => {
  it("ordinary roles cannot view full identity", () => {
    expect(canViewFullSubjectIdentity(Role.SiteCRC)).toBe(false);
    expect(canViewFullSubjectIdentity(Role.Subject)).toBe(false);
    expect(canViewFullSubjectIdentity(Role.ProviderLogistics)).toBe(false);
  });

  it("PI, CRA, sponsor, auditor can view full identity (auditor = read)", () => {
    expect(canViewFullSubjectIdentity(Role.SitePI)).toBe(true);
    expect(canViewFullSubjectIdentity(Role.CRA)).toBe(true);
    expect(canViewFullSubjectIdentity(Role.SponsorAdmin)).toBe(true);
    expect(canViewFullSubjectIdentity(Role.Auditor)).toBe(true);
  });
});

describe("Read-only roles cannot mutate", () => {
  it("Auditor is read-only", () => {
    expect(isReadOnlyRole(Role.Auditor)).toBe(true);
    expect(() => assertCanMutate(Role.Auditor, "r-3")).toThrowError(AuthorizationError);
  });

  it("RegulatorReadOnly is read-only", () => {
    expect(isReadOnlyRole(Role.RegulatorReadOnly)).toBe(true);
    expect(() => assertCanMutate(Role.RegulatorReadOnly, "r-4")).toThrowError(AuthorizationError);
  });

  it("PI may mutate", () => {
    expect(isReadOnlyRole(Role.SitePI)).toBe(false);
    expect(() => assertCanMutate(Role.SitePI, "r-5")).not.toThrow();
  });
});