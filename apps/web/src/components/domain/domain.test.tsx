import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RISK_LABELS,
  RISK_VISUAL,
  SUBJECT_STATUS_LABEL,
  SUBJECT_STATUS_VISUAL,
} from "../../domain/types.js";
import { RiskTag } from "./RiskTag.js";
import { AITag } from "./AITag.js";

describe("Domain types", () => {
  it("RiskLevel visual mapping covers all 4 levels", () => {
    expect(Object.keys(RISK_LABELS)).toEqual(["critical", "high", "medium", "low"]);
    for (const level of ["critical", "high", "medium", "low"] as const) {
      const v = RISK_VISUAL[level];
      expect(v.bg).toMatch(/^var\(--risk-/);
      expect(v.text).toMatch(/^var\(--risk-/);
    }
  });

  it("Subject status labels exist for known values", () => {
    expect(SUBJECT_STATUS_LABEL.screening).toBe("筛查期");
    expect(SUBJECT_STATUS_LABEL["in-treatment"]).toBe("治疗中");
    expect(SUBJECT_STATUS_LABEL.completed).toBe("已完成");
    expect(SUBJECT_STATUS_LABEL.dropout).toBe("已脱落");
  });

  it("Subject status visual palette is defined for all states", () => {
    for (const key of ["screening", "in-treatment", "completed", "dropout"] as const) {
      const v = SUBJECT_STATUS_VISUAL[key];
      expect(v.bg).toMatch(/^#/);
      expect(v.text).toMatch(/^#/);
    }
  });
});

describe("Domain components (SSR smoke)", () => {
  it("RiskTag renders the correct Chinese label and color for each level", () => {
    for (const level of ["critical", "high", "medium", "low"] as const) {
      const html = renderToStaticMarkup(createElement(RiskTag, { level }));
      expect(html).toContain(RISK_LABELS[level]);
      expect(html).toContain(RISK_VISUAL[level].bg);
    }
  });

  it("AITag always renders with the AI suggestion label", () => {
    const html = renderToStaticMarkup(createElement(AITag, {}));
    expect(html).toContain("AI建议");
    expect(html).toContain("#5b21b6");
  });

  it("AITag can render custom label", () => {
    const html = renderToStaticMarkup(createElement(AITag, { label: "AI生成草稿" }));
    expect(html).toContain("AI生成草稿");
  });
});
