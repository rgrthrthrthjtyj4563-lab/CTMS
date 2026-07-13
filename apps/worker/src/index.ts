/**
 * Phase 3 worker entrypoint.
 *
 * Runs an in-process setInterval poll loop (no BullMQ/Redis). Today it
 * drives the protocol-parse queue (Task 3.3); future phases extend
 * classifyJob() / runJob() with risk-scan / report-generation jobs.
 */
import { PrismaClient } from "@prisma/client";
import { AIOutputKind, formatConfidence } from "@aic-dct/domain";
import { startProtocolScanLoop } from "./scan-loop.js";

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
  const prisma = new PrismaClient();
  console.log("[worker] Phase 3 worker started. setInterval poll loop (no BullMQ/Redis).");
  const stop = startProtocolScanLoop(prisma);
  const shutdown = async (): Promise<void> => {
    stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}