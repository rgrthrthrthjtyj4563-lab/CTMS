/**
 * Phase 3 worker entrypoint.
 *
 * Runs an in-process setInterval poll loop (no BullMQ/Redis). It drives
 * the protocol-parse queue (Task 3.3) and the report-generation queue
 * (Task 3.4). Future phases extend with risk-scan jobs.
 */
import { PrismaClient } from "@prisma/client";
import { AIOutputKind, formatConfidence } from "@aic-dct/domain";
import { startProtocolScanLoop } from "./scan-loop.js";
import { startReportScanLoop } from "./report-scan-loop.js";

export interface WorkerJob {
  name: string;
  payload: unknown;
}

export function classifyJob(job: WorkerJob): string {
  if (job.name === "ai.parse.protocol") return AIOutputKind.ProtocolParse;
  if (job.name === "ai.risk.scan") return AIOutputKind.RiskSignal;
  if (job.name === "ai.report.draft") return AIOutputKind.ReportDraft;
  return "unknown";
}

export function describeConfidence(value: number): string {
  return formatConfidence(value).label;
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.js")) {
  const prisma = new PrismaClient();
  console.log("[worker] Phase 3 worker started. setInterval poll loop (no BullMQ/Redis).");
  const stopProtocol = startProtocolScanLoop(prisma);
  const stopReport = startReportScanLoop(prisma);
  const shutdown = async (): Promise<void> => {
    stopProtocol();
    stopReport();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}