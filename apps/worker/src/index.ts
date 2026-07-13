/**
 * Phase 3 worker entrypoint.
 *
 * Runs an in-process setInterval poll loop (no BullMQ/Redis). New
 * AI-driven jobs (protocol parsing in Task 3.3, risk scanning in 3.2)
 * extend classifyJob() / runJob() below.
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
  console.log("[worker] Phase 3 worker idle. setInterval poll loop (no BullMQ/Redis).");
}