import { describe, it, expect, vi } from "vitest";
import {
  AuditObjectType,
  AuditAction,
  criticalActionMeta,
  isCriticalAction,
  recordAuditEvent,
  type AuditEvent,
} from "./audit.js";
import { ApiErrorCode, ApiErrorException } from "./errors.js";

describe("Audit taxonomy", () => {
  it("marks SAE close as critical with required reason", () => {
    expect(isCriticalAction(AuditObjectType.SafetyEvent, AuditAction.Close)).toBe(true);
    const meta = criticalActionMeta(AuditObjectType.SafetyEvent, AuditAction.Close);
    expect(meta?.requiresReason).toBe(true);
    expect(meta?.requiresConfirmation).toBe(true);
  });

  it("marks report export as critical with required reason", () => {
    const meta = criticalActionMeta(AuditObjectType.ReportDraft, AuditAction.Export);
    expect(meta?.requiresReason).toBe(true);
  });

  it("marks protocol activation as critical", () => {
    const meta = criticalActionMeta(AuditObjectType.ProtocolVersion, AuditAction.ProtocolActivated);
    expect(meta?.requiresConfirmation).toBe(true);
    expect(meta?.requiresReason).toBe(true);
  });

  it("non-critical action has no metadata", () => {
    const meta = criticalActionMeta(AuditObjectType.Subject, AuditAction.Create);
    expect(meta).toBeUndefined();
  });
});

describe("recordAuditEvent", () => {
  it("writes an audit event for non-critical actions", async () => {
    const persist = vi.fn(async (_e: AuditEvent) => {});
    const event = await recordAuditEvent(
      { persist },
      {
        actorUserId: "u1",
        actorRole: "SiteCRC",
        projectId: "p1",
        objectType: AuditObjectType.Subject,
        objectId: "s1",
        action: AuditAction.Create,
      },
    );

    expect(persist).toHaveBeenCalledOnce();
    expect(event.actorUserId).toBe("u1");
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("blocks critical actions missing a reason", async () => {
    const persist = vi.fn(async (_e: AuditEvent) => {});
    await expect(
      recordAuditEvent(
        { persist },
        {
          actorUserId: "u1",
          actorRole: "SitePI",
          projectId: "p1",
          objectType: AuditObjectType.SafetyEvent,
          objectId: "se1",
          action: AuditAction.Close,
          // reason intentionally missing
        },
      ),
    ).rejects.toMatchObject({ code: ApiErrorCode.REASON_REQUIRED });
    expect(persist).not.toHaveBeenCalled();
  });

  it("writes audit event when reason is provided", async () => {
    const persist = vi.fn(async (_e: AuditEvent) => {});
    const event = await recordAuditEvent(
      { persist },
      {
        actorUserId: "u1",
        actorRole: "SitePI",
        projectId: "p1",
        objectType: AuditObjectType.SafetyEvent,
        objectId: "se1",
        action: AuditAction.Close,
        reason: "Event resolved with PI review",
      },
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(event.reason).toBe("Event resolved with PI review");
  });

  it("rejects blank reason for required-reason actions", async () => {
    const persist = vi.fn(async (_e: AuditEvent) => {});
    await expect(
      recordAuditEvent(
        { persist },
        {
          actorUserId: "u1",
          actorRole: "SitePI",
          projectId: "p1",
          objectType: AuditObjectType.SafetyEvent,
          objectId: "se1",
          action: AuditAction.Close,
          reason: "   ",
        },
      ),
    ).rejects.toBeInstanceOf(ApiErrorException);
  });
});