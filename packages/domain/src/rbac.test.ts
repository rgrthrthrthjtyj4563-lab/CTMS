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
    expect(perms).not.toContain(Permission.SubjectReadFull);
    expect(perms).not.toContain(Permission.SafetyRead);
  });

  it("ProviderLogistics only sees drug/sample permissions", () => {
    const perms = rolePermissions(Role.ProviderLogistics);
    expect(perms).toContain(Permission.DrugDispatch);
    expect(perms).toContain(Permission.SampleTransfer);
    expect(perms).not.toContain(Permission.SubjectReadFull);
    expect(perms).not.toContain(Permission.SafetyConfirm);
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