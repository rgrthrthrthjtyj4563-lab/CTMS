import { describe, it, expect } from "vitest";
import { cn } from "../lib/cn.js";

describe("cn", () => {
  it("merges tailwind classes, last wins for conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("supports conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
