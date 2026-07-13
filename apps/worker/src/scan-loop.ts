/**
 * Protocol parse scan loop (Phase 3 Task 3.3).
 *
 * Polls for ProtocolVersion rows in parseStatus=Parsing, runs them through
 * the AI provider, writes back:
 *   - AIProtocolParseResult (status=Pending, fields + confidence)
 *   - AIOutput (kind=ProtocolParse, prompt + model metadata)
 *   - AICallLog (timing + statusCode)
 *   - flips parseStatus to Parsed (or ParseFailed on failure)
 *
 * The function is pure: it accepts a PrismaClient and an AIProvider so the
 * worker process can plug in the real singletons while tests pass in fakes.
 * The scan loop is started by {@link startProtocolScanLoop} via setInterval.
 */
import {
  AIOutputKind,
  HumanConfirmationStatus,
  ProtocolParseStatus,
} from "@aic-dct/domain";
import type { PrismaClient } from "@prisma/client";
import { mockAIProvider, type AIProvider } from "./providers/mock-ai-provider.js";

type PrismaClientLike = PrismaClient;

const PROMPT_CODE = "protocol-parse-v1";

export interface ScanSummary {
  scanned: number;
  parsed: number;
  failed: number;
}

/** Find-or-create the singleton PromptTemplate row used by protocol parse. */
export async function ensureProtocolPromptTemplate(
  prisma: PrismaClientLike,
): Promise<{ id: string }> {
  const existing = await prisma.promptTemplate.findFirst({
    where: { code: PROMPT_CODE },
  });
  if (existing) return existing;
  return prisma.promptTemplate.create({
    data: {
      code: PROMPT_CODE,
      version: "1.0.0",
      body: "Parse the protocol PDF and extract eligibility, visits, safety points.",
      variables: ["documentUrl", "version"],
      outputKind: AIOutputKind.ProtocolParse,
    },
  });
}

/** Compute a stable hash of the document URL + version for audit trail. */
function computeInputHash(documentUrl: string, version: string): string {
  // djb2 hash is sufficient for an input fingerprint that the audit log
  // surfaces next to the AI output; we don't need crypto strength here.
  let hash = 5381;
  const s = `${documentUrl}::${version}`;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
}

/**
 * Run one scan pass: find rows in Parsing, run AI, write AIProtocolParseResult
 * + AIOutput + AICallLog, flip parseStatus to Parsed.
 *
 * Returns counts so the caller can log a one-line summary.
 */
export async function scanProtocolQueue(
  prisma: PrismaClientLike,
  provider: AIProvider = mockAIProvider,
): Promise<ScanSummary> {
  const queue = await prisma.protocolVersion.findMany({
    where: { parseStatus: ProtocolParseStatus.Parsing },
  });
  let parsed = 0;
  let failed = 0;
  for (const row of queue) {
    const startedAt = new Date();
    try {
      const prompt = await ensureProtocolPromptTemplate(prisma);
      const result = await provider.parseProtocol({
        documentUrl: row.documentUrl,
        version: row.version,
      });
      const inputHash = computeInputHash(row.documentUrl, row.version);
      const aiOutput = await prisma.aIOutput.create({
        data: {
          kind: AIOutputKind.ProtocolParse,
          projectId: row.projectId,
          subjectId: null,
          // Prisma's JSON column accepts arbitrary objects; the field type
          // is `Json` so we cast through unknown to satisfy the strict
          // InputJsonValue typing without losing our parsed payload shape.
          payload: result.fields as unknown as object,
          confidence: result.confidence,
          confidenceLevel: result.confidenceLevel,
          status: HumanConfirmationStatus.Pending,
          promptTemplateId: prompt.id,
          model: "mock-ai/v1",
          modelVersion: "2026-07-13",
          inputHash,
          knowledgeBaseRefs: ["kb/protocol-parse-v1"],
        },
      });
      await Promise.all([
        prisma.aICallLog.create({
          data: {
            aiOutputId: aiOutput.id,
            promptTemplateId: prompt.id,
            model: "mock-ai/v1",
            inputHash,
            startedAt,
            finishedAt: new Date(),
            statusCode: 200,
          },
        }),
        prisma.aIProtocolParseResult.create({
          data: {
            protocolVersionId: row.id,
            status: HumanConfirmationStatus.Pending,
            fields: result.fields as unknown as object,
            confidence: result.confidence,
            aiOutputId: aiOutput.id,
          },
        }),
        prisma.protocolVersion.update({
          where: { id: row.id },
          data: { parseStatus: ProtocolParseStatus.Parsed },
        }),
      ]);
      parsed += 1;
    } catch (err) {
      failed += 1;
      // Best-effort: still flip the row out of Parsing so the queue moves on.
      await prisma.protocolVersion.update({
        where: { id: row.id },
        data: { parseStatus: ProtocolParseStatus.ParseFailed },
      });
      console.error(
        `[worker] protocol scan failed for ${row.id} (${row.version}):`,
        err,
      );
    }
  }
  return { scanned: queue.length, parsed, failed };
}

/**
 * Start the in-process scan loop. Returns a stop() that clears the timer.
 * Default cadence: 5 minutes. Worker entrypoint invokes this once.
 */
export function startProtocolScanLoop(
  prisma: PrismaClientLike,
  options: { intervalMs?: number; provider?: AIProvider } = {},
): () => void {
  const intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  const provider = options.provider ?? mockAIProvider;
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const summary = await scanProtocolQueue(prisma, provider);
      if (summary.scanned > 0) {
        console.log(
          `[worker] protocol scan: scanned=${summary.scanned} parsed=${summary.parsed} failed=${summary.failed}`,
        );
      }
    } catch (err) {
      console.error("[worker] protocol scan loop error:", err);
    }
  };
  // Run once immediately so an enqueued row doesn't wait the full interval.
  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);
  return () => {
    stopped = true;
    clearInterval(handle);
  };
}