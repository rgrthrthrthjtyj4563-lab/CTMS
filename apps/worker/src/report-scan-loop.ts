/**
 * Report generation scan loop (Phase 3 Task 3.4).
 *
 * Polls for ReportDraft rows in status=Generating, runs them through the
 * mock AI provider to build a report snapshot, and writes:
 *   - AIOutput (kind=ReportDraft, snapshot of project state used as input)
 *   - AICallLog (timing + statusCode)
 *   - flips status to Draft
 *
 * The report snapshot captures the source data the AI "digested" — subject
 * counts, AE/SAE totals, open risk signals — so the audit trail can
 * reconstruct what the model saw. The same inputHash lets us re-derive a
 * stable confidence from the mock provider without re-querying the DB.
 *
 * Pure function: accepts a PrismaClient so the worker process uses the real
 * singleton while tests pass in a fake.
 */
import {
  AIOutputKind,
  ConfidenceLevel,
  formatConfidence,
  HumanConfirmationStatus,
  ReportStatus,
} from "@aic-dct/domain";
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

type PrismaClientLike = PrismaClient;

const PROMPT_CODE = "report-draft-v1";

export interface ReportScanSummary {
  scanned: number;
  generated: number;
  failed: number;
}

export interface ReportSnapshot {
  projectId: string;
  type: string;
  subjectCounts: {
    total: number;
    active: number;
    completed: number;
    screenFailed: number;
  };
  aeCounts: {
    total: number;
    serious: number;
    openInvestigatorReview: number;
  };
  riskCounts: {
    open: number;
    high: number;
    critical: number;
  };
  generatedAt: string;
  /** AI confidence in the snapshot. Mock only. */
  confidence: number;
  confidenceLevel: "Low" | "Medium" | "High";
  /** Human-readable summary line (Chinese). Always labelled AI 草稿. */
  aiSummary: string;
}

/** Build the snapshot that will be attached to the AI output payload. */
async function buildReportSnapshot(
  prisma: PrismaClientLike,
  row: { id: string; projectId: string; type: string },
): Promise<ReportSnapshot> {
  const projectId = row.projectId;
  // Subject counts (active / completed / screenFailed). We deliberately
  // skip the other statuses from the snapshot — the AI summary references
  // the high-level activity band, not every status.
  const [total, active, completed, screenFailed] = await Promise.all([
    prisma.subject.count({ where: { projectId } }),
    prisma.subject.count({ where: { projectId, status: "Active" } }),
    prisma.subject.count({ where: { projectId, status: "Completed" } }),
    prisma.subject.count({ where: { projectId, status: "ScreenFailed" } }),
  ]);
  const [aeTotal, aeSerious, aeOpenReview] = await Promise.all([
    prisma.safetyEvent.count({ where: { projectId } }),
    prisma.safetyEvent.count({ where: { projectId, isSerious: true } }),
    prisma.safetyEvent.count({
      where: { projectId, status: "InvestigatorReview" },
    }),
  ]);
  const [riskOpen, riskHigh, riskCritical] = await Promise.all([
    prisma.riskSignal.count({ where: { projectId, status: "Open" } }),
    prisma.riskSignal.count({ where: { projectId, level: "High" } }),
    prisma.riskSignal.count({ where: { projectId, level: "Critical" } }),
  ]);

  // Deterministic confidence from the projectId+type so reruns are stable.
  const seed = `${projectId}::${row.type}::${row.id}`;
  const digest = createHash("sha256").update(seed).digest();
  const raw = digest.readUInt16BE(0) / 65535;
  const confidence = Math.round((0.7 + raw * 0.25) * 100) / 100;
  const confidenceLevel: "Low" | "Medium" | "High" =
    confidence >= 0.85 ? "High" : confidence >= 0.7 ? "Medium" : "Low";
  const summary = formatConfidence(confidence).label;

  return {
    projectId,
    type: row.type,
    subjectCounts: { total, active, completed, screenFailed },
    aeCounts: {
      total: aeTotal,
      serious: aeSerious,
      openInvestigatorReview: aeOpenReview,
    },
    riskCounts: {
      open: riskOpen,
      high: riskHigh,
      critical: riskCritical,
    },
    generatedAt: new Date().toISOString(),
    confidence,
    confidenceLevel,
    aiSummary: `AI 草稿（${row.type}）：受试者 ${total} 例（Active ${active} / Completed ${completed}），AE ${aeTotal} 例（其中 SAE ${aeSerious}），待研究者处理 ${aeOpenReview} 例；开放风险 ${riskOpen} 条（含 High ${riskHigh}、Critical ${riskCritical}）。${summary}。`,
  };
}

/** Find-or-create the singleton PromptTemplate row used by report generation. */
export async function ensureReportPromptTemplate(
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
      body: "Generate a project status report draft from subject / safety / risk snapshots.",
      variables: ["projectId", "type", "subjectCounts", "aeCounts", "riskCounts"],
      outputKind: AIOutputKind.ReportDraft,
    },
  });
}

/** djb2 hash is sufficient for an input fingerprint in the audit log. */
function computeInputHash(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
}

/**
 * Run one scan pass: find rows in Generating, build the snapshot via the
 * mock AI provider, write AIOutput + AICallLog, flip status to Draft.
 *
 * Returns counts so the caller can log a one-line summary.
 */
export async function scanReportQueue(
  prisma: PrismaClientLike,
): Promise<ReportScanSummary> {
  const queue = await prisma.reportDraft.findMany({
    where: { status: ReportStatus.Generating },
  });
  let generated = 0;
  let failed = 0;
  for (const row of queue) {
    const startedAt = new Date();
    try {
      const snapshot = await buildReportSnapshot(prisma, row);
      const prompt = await ensureReportPromptTemplate(prisma);
      const inputHash = computeInputHash(
        `${row.projectId}::${row.type}::${row.id}`,
      );
      const aiOutput = await prisma.aIOutput.create({
        data: {
          kind: AIOutputKind.ReportDraft,
          projectId: row.projectId,
          subjectId: null,
          payload: snapshot as unknown as object,
          confidence: snapshot.confidence,
          confidenceLevel:
            snapshot.confidenceLevel === "High"
              ? ConfidenceLevel.High
              : snapshot.confidenceLevel === "Medium"
                ? ConfidenceLevel.Medium
                : ConfidenceLevel.Low,
          status: HumanConfirmationStatus.Pending,
          promptTemplateId: prompt.id,
          model: "mock-ai/v1",
          modelVersion: "2026-07-13",
          inputHash,
          knowledgeBaseRefs: ["kb/report-draft-v1"],
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
        prisma.reportDraft.update({
          where: { id: row.id },
          data: {
            status: ReportStatus.Draft,
            // The reportDraft model has a `sourceSnapshotId` column but
            // we also persist the full payload on the linked AIOutput, so
            // the audit chain can re-derive the snapshot from the AIOutput
            // payload without joining additional tables.
            sourceSnapshotId: aiOutput.id,
          },
        }),
      ]);
      generated += 1;
    } catch (err) {
      failed += 1;
      await prisma.reportDraft.update({
        where: { id: row.id },
        data: { status: ReportStatus.Failed },
      });
      console.error(
        `[worker] report scan failed for ${row.id} (${row.type}):`,
        err,
      );
    }
  }
  return { scanned: queue.length, generated, failed };
}

/**
 * Start the in-process report scan loop. Returns a stop() that clears
 * the timer. Default cadence: 5 minutes (mirrors the protocol loop).
 */
export function startReportScanLoop(
  prisma: PrismaClientLike,
  options: { intervalMs?: number } = {},
): () => void {
  const intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const summary = await scanReportQueue(prisma);
      if (summary.scanned > 0) {
        console.log(
          `[worker] report scan: scanned=${summary.scanned} generated=${summary.generated} failed=${summary.failed}`,
        );
      }
    } catch (err) {
      console.error("[worker] report scan loop error:", err);
    }
  };
  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);
  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
