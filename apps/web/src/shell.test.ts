import { describe, it, expect } from "vitest";
import { WEB_PHASE } from "./shell.js";

describe("web Phase 0 stub", () => {
  it("exposes a phase label", () => {
    expect(WEB_PHASE).toMatch(/Phase 0/);
  });
});