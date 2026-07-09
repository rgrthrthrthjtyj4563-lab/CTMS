import { describe, it, expect } from "vitest";
import {
  AIOutputKind,
  AISourceSchema,
  AIOutputSchema,
  applyAIConfirmation,
  canPromoteAIOutput,
  formatConfidence,
  ConfidenceLevel,
} from "./ai.js";
import { HumanConfirmationStatus } from "./enums.js";
import { ApiErrorCode } from "./errors.js";

function baseOutput() {
  return AIOutputSchema.parse({
    kind: AIOutputKind.RiskSignal,
    projectId: "p1",
    payload: { suggestion: "Schedule extra visit" },
    confidence: 0.72,
    confidenceLevel: ConfidenceLevel.Medium,
    source: {
      model: "claude-3.5",
      modelVersion: "2024-06-20",
      promptTemplateId: "tpl-risk-v1",
      promptVersion: "1.0.0",
      knowledgeBaseRefs: ["kb/protocol-a"],
      inputHash: "abc123",
    },
    generatedAt: new Date(),
    status: HumanConfirmationStatus.Pending,
  });
}

describe("AI source schema", () => {
  it("requires model, version, template id, version, input hash", () => {
    expect(() =>
      AISourceSchema.parse({ model: "x" }),
    ).toThrow();
  });
});

describe("AI output lifecycle", () => {
  it("Pending -> Adopted succeeds with actor", () => {
    const out = baseOutput();
    const next = applyAIConfirmation(
      out,
      HumanConfirmationStatus.Adopted,
      { userId: "u-pi" },
    );
    expect(next.status).toBe(HumanConfirmationStatus.Adopted);
    expect(next.confirmedByUserId).toBe("u-pi");
    expect(canPromoteAIOutput(next)).toBe(true);
  });

  it("Pending -> Rejected requires reason", () => {
    const out = baseOutput();
    expect(() =>
      applyAIConfirmation(
        out,
        HumanConfirmationStatus.Rejected,
        { userId: "u-pi" },
      ),
    ).toThrowError(expect.objectContaining({ code: ApiErrorCode.REASON_REQUIRED }));
  });

  it("Pending -> Rejected succeeds with reason", () => {
    const out = baseOutput();
    const next = applyAIConfirmation(
      out,
      HumanConfirmationStatus.Rejected,
      { userId: "u-pi" },
      { reason: "Insufficient evidence" },
    );
    expect(next.status).toBe(HumanConfirmationStatus.Rejected);
    expect(next.rejectionReason).toBe("Insufficient evidence");
    expect(canPromoteAIOutput(next)).toBe(false);
  });

  it("Adopted is terminal", () => {
    const out = baseOutput();
    const adopted = applyAIConfirmation(
      out,
      HumanConfirmationStatus.Adopted,
      { userId: "u-pi" },
    );
    expect(() =>
      applyAIConfirmation(
        adopted,
        HumanConfirmationStatus.Rejected,
        { userId: "u-pi" },
        { reason: "revert" },
      ),
    ).toThrowError(expect.objectContaining({ code: ApiErrorCode.STATE_TRANSITION_INVALID }));
  });

  it("Pending output cannot be promoted", () => {
    const out = baseOutput();
    expect(canPromoteAIOutput(out)).toBe(false);
  });

  it("allows Pending -> NeedsInvestigatorConfirmation", () => {
    const out = baseOutput();
    const next = applyAIConfirmation(
      out,
      HumanConfirmationStatus.NeedsInvestigatorConfirmation,
      { userId: "u-crc" },
    );
    expect(next.status).toBe(HumanConfirmationStatus.NeedsInvestigatorConfirmation);
    expect(next.confirmedByUserId).toBe("u-crc");
    expect(canPromoteAIOutput(next)).toBe(false);
  });
});

describe("formatConfidence", () => {
  it("returns High for >=0.8", () => {
    const r = formatConfidence(0.9);
    expect(r.level).toBe(ConfidenceLevel.High);
    expect(r.label).toMatch(/人工复核/);
  });
  it("returns Medium for 0.5-0.79", () => {
    expect(formatConfidence(0.55).level).toBe(ConfidenceLevel.Medium);
  });
  it("returns Low for <0.5", () => {
    expect(formatConfidence(0.1).level).toBe(ConfidenceLevel.Low);
  });
});