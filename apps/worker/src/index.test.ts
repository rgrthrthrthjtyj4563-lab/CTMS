import { describe, it, expect } from "vitest";
import { classifyJob, describeConfidence } from "./index.js";

describe("worker skeleton", () => {
  it("classifies protocol parse jobs", () => {
    expect(classifyJob({ name: "ai.parse.protocol", payload: {} })).toBe("ProtocolParse");
  });
  it("classifies risk scan jobs", () => {
    expect(classifyJob({ name: "ai.risk.scan", payload: {} })).toBe("RiskSignal");
  });
  it("returns unknown for unmapped jobs", () => {
    expect(classifyJob({ name: "noop", payload: {} })).toBe("unknown");
  });
  it("describeConfidence never returns a medical finality phrase", () => {
    const label = describeConfidence(0.9);
    expect(label).not.toMatch(/确诊|诊断/);
    expect(label).toMatch(/人工复核/);
  });
});