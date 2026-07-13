/**
 * Report scan loop tests — Phase 3 Task 3.4.
 *
 * Uses an in-memory fake Prisma so we can verify that scanReportQueue:
 *   - picks rows where status=Generating
 *   - builds a snapshot from subject / safety / risk counts
 *   - writes AIOutput (kind=ReportDraft) + AICallLog
 *   - flips status to Draft on success / Failed on error
 *
 * The fake Prisma records every call so tests can assert side-effects
 * without spinning up a real Postgres.
 */
import { describe, it, expect } from "vitest";
import {
  AIOutputKind,
  HumanConfirmationStatus,
  ReportStatus,
} from "@aic-dct/domain";
import { scanReportQueue } from "./report-scan-loop.js";

type Row = {
  id: string;
  projectId: string;
  type: string;
  status: ReportStatus;
};

interface FakePrisma {
  reportDraft: {
    rows: Row[];
    findManyCalls: Array<{ where: { status: ReportStatus } }>;
    updateCalls: Array<{ where: { id: string }; data: { status: ReportStatus } }>;
  };
  promptTemplate: { rows: Array<{ id: string; code: string; version: string }> };
  aIOutput: { created: Array<Record<string, unknown>> };
  aICallLog: { created: Array<Record<string, unknown>> };
  subject: {
    countCalls: Array<{ where: Record<string, unknown> }>;
    counts: Array<{ where: Record<string, unknown>; value: number }>;
  };
  safetyEvent: {
    countCalls: Array<{ where: Record<string, unknown> }>;
    counts: Array<{ where: Record<string, unknown>; value: number }>;
  };
  riskSignal: {
    countCalls: Array<{ where: Record<string, unknown> }>;
    counts: Array<{ where: Record<string, unknown>; value: number }>;
  };
}

function buildFakePrisma(): FakePrisma {
  return {
    reportDraft: {
      rows: [],
      findManyCalls: [],
      updateCalls: [],
    },
    promptTemplate: { rows: [] },
    aIOutput: { created: [] },
    aICallLog: { created: [] },
    subject: { countCalls: [], counts: [] },
    safetyEvent: { countCalls: [], counts: [] },
    riskSignal: { countCalls: [], counts: [] },
  };
}

function findCount(
  counts: Array<{ where: Record<string, unknown>; value: number }>,
  where: Record<string, unknown>,
): number {
  // Naive matcher: any field equal to a where field is a match. For our
  // single-test use, this is sufficient because the call sites only vary
  // one filter at a time.
  const match = counts.find((c) => {
    for (const k of Object.keys(where)) {
      if (JSON.stringify(c.where[k]) !== JSON.stringify((where as Record<string, unknown>)[k])) {
        return false;
      }
    }
    return true;
  });
  return match?.value ?? 0;
}

/**
 * Hand-rolled Prisma facade — the scan loop only uses count, findMany,
 * findFirst, create, and update. The fake records inputs and returns
 * synthetic rows so we can verify the worker's contract without a DB.
 */
function buildFacade(fake: FakePrisma): unknown {
  return {
    reportDraft: {
      findMany: async (args: { where: { status: ReportStatus } }) => {
        fake.reportDraft.findManyCalls.push(args);
        return fake.reportDraft.rows.filter(
          (r) => r.status === args.where.status,
        );
      },
      update: async (args: { where: { id: string }; data: { status: ReportStatus } }) => {
        fake.reportDraft.updateCalls.push(args);
        const row = fake.reportDraft.rows.find((r) => r.id === args.where.id);
        if (!row) throw new Error(`no row ${args.where.id}`);
        row.status = args.data.status;
        return row;
      },
    },
    promptTemplate: {
      findFirst: async (args: { where: { code: string } }) => {
        return (
          fake.promptTemplate.rows.find((r) => r.code === args.where.code) ?? null
        );
      },
      create: async (args: {
        data: {
          code: string;
          version: string;
          body: string;
          variables: string[];
          outputKind: string;
        };
      }) => {
        const row = {
          id: `prompt-${fake.promptTemplate.rows.length + 1}`,
          ...args.data,
        };
        fake.promptTemplate.rows.push(row);
        return row;
      },
    },
    aIOutput: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: `output-${fake.aIOutput.created.length + 1}`,
          ...args.data,
        };
        fake.aIOutput.created.push(row);
        return row;
      },
    },
    aICallLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        fake.aICallLog.created.push(args.data);
        return args.data;
      },
    },
    subject: {
      count: async (args: { where: Record<string, unknown> }) => {
        fake.subject.countCalls.push(args);
        return findCount(fake.subject.counts, args.where);
      },
    },
    safetyEvent: {
      count: async (args: { where: Record<string, unknown> }) => {
        fake.safetyEvent.countCalls.push(args);
        return findCount(fake.safetyEvent.counts, args.where);
      },
    },
    riskSignal: {
      count: async (args: { where: Record<string, unknown> }) => {
        fake.riskSignal.countCalls.push(args);
        return findCount(fake.riskSignal.counts, args.where);
      },
    },
  };
}

describe("scanReportQueue", () => {
  it("returns zeroed summary when nothing is Generating", async () => {
    const fake = buildFakePrisma();
    const prisma = buildFacade(fake) as Parameters<typeof scanReportQueue>[0];
    const summary = await scanReportQueue(prisma);
    expect(summary).toEqual({ scanned: 0, generated: 0, failed: 0 });
    expect(fake.aIOutput.created).toHaveLength(0);
  });

  it("generates every row in Generating and writes AI artifacts", async () => {
    const fake = buildFakePrisma();
    fake.reportDraft.rows = [
      {
        id: "r-1",
        projectId: "p-1",
        type: "Interim",
        status: ReportStatus.Generating,
      },
      {
        id: "r-2",
        projectId: "p-1",
        type: "Final",
        status: ReportStatus.Generating,
      },
    ];
    fake.subject.counts = [
      { where: { projectId: "p-1" }, value: 120 },
      { where: { projectId: "p-1", status: "Active" }, value: 80 },
      { where: { projectId: "p-1", status: "Completed" }, value: 25 },
      { where: { projectId: "p-1", status: "ScreenFailed" }, value: 5 },
    ];
    fake.safetyEvent.counts = [
      { where: { projectId: "p-1" }, value: 4 },
      { where: { projectId: "p-1", isSerious: true }, value: 1 },
      {
        where: { projectId: "p-1", status: "InvestigatorReview" },
        value: 1,
      },
    ];
    fake.riskSignal.counts = [
      { where: { projectId: "p-1", status: "Open" }, value: 3 },
      { where: { projectId: "p-1", level: "High" }, value: 1 },
      { where: { projectId: "p-1", level: "Critical" }, value: 1 },
    ];
    const prisma = buildFacade(fake) as Parameters<typeof scanReportQueue>[0];
    const summary = await scanReportQueue(prisma);
    expect(summary.scanned).toBe(2);
    expect(summary.generated).toBe(2);
    expect(summary.failed).toBe(0);
    expect(fake.aIOutput.created).toHaveLength(2);
    expect(fake.aICallLog.created).toHaveLength(2);
    expect(fake.promptTemplate.rows).toHaveLength(1);
    // Rows flipped to Draft.
    expect(
      fake.reportDraft.rows.every((r) => r.status === ReportStatus.Draft),
    ).toBe(true);
    // AI output is Pending — human gate intact.
    expect(fake.aIOutput.created[0]?.status).toBe(
      HumanConfirmationStatus.Pending,
    );
    expect(fake.aIOutput.created[0]?.kind).toBe(AIOutputKind.ReportDraft);
    // The snapshot includes the human-readable AI summary, always
    // labelled "AI 草稿" (mock provider contract).
    const payload = fake.aIOutput.created[0]?.payload as {
      aiSummary: string;
    };
    expect(payload.aiSummary).toContain("AI 草稿");
  });

  it("flips Failed when the snapshot builder throws (defense-in-depth)", async () => {
    const fake = buildFakePrisma();
    fake.reportDraft.rows = [
      {
        id: "r-bad",
        projectId: "p-1",
        type: "Interim",
        status: ReportStatus.Generating,
      },
    ];
    // Drop the subject.count facade so the first call throws. This
    // exercises the catch branch and verifies the row is flipped to
    // Failed (not left in Generating forever).
    const facade = buildFacade(fake) as Record<string, unknown> & {
      subject: { count: () => Promise<number> };
    };
    facade.subject = {
      count: async () => {
        throw new Error("mock snapshot boom");
      },
    };
    const summary = await scanReportQueue(
      facade as Parameters<typeof scanReportQueue>[0],
    );
    expect(summary.failed).toBe(1);
    expect(summary.generated).toBe(0);
    expect(fake.reportDraft.rows[0]?.status).toBe(ReportStatus.Failed);
  });
});
