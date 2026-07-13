/**
 * Mock AI provider tests — Phase 3 Task 3.3.
 *
 * Verifies the deterministic output shape (no medical finality phrases)
 * and that the confidence bucketing lands in the expected range.
 */
import { describe, it, expect } from "vitest";
import { MockAIProvider } from "./mock-ai-provider.js";

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  it("parseProtocol returns deterministic fields for the same input", async () => {
    const a = await provider.parseProtocol({
      documentUrl: "https://files.example.test/a.pdf",
      version: "v1",
    });
    const b = await provider.parseProtocol({
      documentUrl: "https://files.example.test/a.pdf",
      version: "v1",
    });
    expect(a.confidence).toBe(b.confidence);
    expect(a.confidenceLevel).toBe(b.confidenceLevel);
    expect(a.fields.summary).toBe(b.fields.summary);
  });

  it("parseProtocol confidence lands in [0.55, 0.95] and never finality-phrases", async () => {
    const out = await provider.parseProtocol({
      documentUrl: "https://files.example.test/v3.pdf",
      version: "v3.0",
    });
    expect(out.confidence).toBeGreaterThanOrEqual(0.55);
    expect(out.confidence).toBeLessThanOrEqual(0.95);
    expect(out.fields.summary).not.toMatch(/确诊|诊断|判定/);
    expect(out.fields.eligibility.length).toBeGreaterThan(0);
    expect(out.fields.visits.length).toBeGreaterThan(0);
    expect(out.fields.safetyPoints.length).toBeGreaterThan(0);
  });

  it("scanRisk returns suggestion + confidence without medical finality", async () => {
    const out = await provider.scanRisk({ subjectTimeline: { visits: 3 } });
    expect(out.suggestion).toMatch(/AI 建议/);
    expect(out.confidence).toBeGreaterThanOrEqual(0.55);
    expect(out.suggestion).not.toMatch(/确诊|诊断/);
  });
});