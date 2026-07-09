/**
 * Phase 0 worker skeleton.
 *
 * Real BullMQ + Redis wiring is added in Phase 3. This entrypoint exists so
 * `npm run dev` boots a no-op loop and so phase-3 jobs have a stable
 * extension point.
 */
import { AIOutputKind, formatConfidence } from "@aic-dct/domain";

export interface WorkerJob {
  name: string;
  payload: unknown;
}

export function classifyJob(job: WorkerJob): string {
  if (job.name === "ai.parse.protocol") return AIOutputKind.ProtocolParse;
  if (job.name === "ai.risk.scan") return AIOutputKind.RiskSignal;
  return "unknown";
}

export function describeConfidence(value: number): string {
  return formatConfidence(value).label;
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.js")) {
  // eslint-disable-next-line no-console
  console.log("[worker] Phase 0 worker idle. Phase 3 wires BullMQ jobs.");
}