/**
 * Mock AI provider for Phase 3 worker.
 *
 * Returns deterministic JSON based on the input hash. No network call, no
 * real model. Phase 4/5 will swap this with a real provider (Anthropic /
 * OpenAI / local) implementing the same {@link AIProvider} interface.
 */
import { createHash } from "node:crypto";

export interface AIProvider {
  parseProtocol(input: {
    documentUrl: string;
    version: string;
  }): Promise<{
    fields: ProtocolParseFields;
    confidence: number;
    confidenceLevel: "Low" | "Medium" | "High";
  }>;
  scanRisk(input: {
    subjectTimeline: unknown;
  }): Promise<{
    suggestion: string;
    confidence: number;
    confidenceLevel: "Low" | "Medium" | "High";
  }>;
}

export interface ProtocolParseFields {
  /** High-level study summary surfaced to the workbench overview tab. */
  summary: string;
  /** Inclusion / exclusion criteria list — one bullet per item. */
  eligibility: string[];
  /** Visit schedule skeleton; phase 4 fills task-level granularity. */
  visits: Array<{ code: string; label: string; dayOffset: number }>;
  /** Safety risk points the worker flagged from the document text. */
  safetyPoints: string[];
  /** Confidence annotations per field; phase 3 returns a single global value. */
  fieldConfidence: Record<string, number>;
}

const SAMPLE_VISITS: Array<{ code: string; label: string; dayOffset: number }> = [
  { code: "V1", label: "筛选期", dayOffset: -28 },
  { code: "V2", label: "基线 / 给药 D1", dayOffset: 0 },
  { code: "V3", label: "D8 安全性访视", dayOffset: 7 },
  { code: "V4", label: "D15 疗效评估", dayOffset: 14 },
  { code: "V5", label: "D28 随访", dayOffset: 28 },
];

const SAMPLE_SAFETY = [
  "≥3 级中性粒细胞减少需 24h 内 IRB 上报",
  "肝功能 ALT/AST > 5×ULN 暂停给药",
  "QTc > 500ms 立即停药并心内科会诊",
];

function hashConfidence(input: string): {
  confidence: number;
  confidenceLevel: "Low" | "Medium" | "High";
} {
  const digest = createHash("sha256").update(input).digest();
  const raw = digest.readUInt16BE(0) / 65535; // 0..1
  // Bias the distribution toward mid/high to keep demo realistic.
  const value = 0.55 + raw * 0.4;
  const confidence = Math.round(value * 100) / 100;
  const confidenceLevel: "Low" | "Medium" | "High" =
    confidence >= 0.85 ? "High" : confidence >= 0.7 ? "Medium" : "Low";
  return { confidence, confidenceLevel };
}

export class MockAIProvider implements AIProvider {
  async parseProtocol(input: {
    documentUrl: string;
    version: string;
  }): Promise<{
    fields: ProtocolParseFields;
    confidence: number;
    confidenceLevel: "Low" | "Medium" | "High";
  }> {
    const seed = `${input.documentUrl}::${input.version}`;
    const { confidence, confidenceLevel } = hashConfidence(seed);
    return {
      fields: {
        summary: `AI 解析：方案 ${input.version}（mock provider，无医学结论词）。`,
        eligibility: [
          "≥18 周岁，经组织学确诊的 B 细胞淋巴瘤",
          "ECOG ≤ 2，预期生存 ≥ 12 周",
          "既往至少一线治疗失败",
          "排除：活动性感染、严重心肝肾功能不全",
        ],
        visits: SAMPLE_VISITS,
        safetyPoints: SAMPLE_SAFETY,
        fieldConfidence: {
          summary: confidence,
          eligibility: confidence,
          visits: confidence,
          safetyPoints: confidence,
        },
      },
      confidence,
      confidenceLevel,
    };
  }

  async scanRisk(input: {
    subjectTimeline: unknown;
  }): Promise<{
    suggestion: string;
    confidence: number;
    confidenceLevel: "Low" | "Medium" | "High";
  }> {
    const seed = JSON.stringify(input.subjectTimeline ?? {});
    const { confidence, confidenceLevel } = hashConfidence(seed);
    return {
      suggestion: "AI 建议：建议关注 V4 访视窗口并复查血常规。",
      confidence,
      confidenceLevel,
    };
  }
}

/** Singleton used by the worker scan loop. Tests can construct their own. */
export const mockAIProvider: AIProvider = new MockAIProvider();