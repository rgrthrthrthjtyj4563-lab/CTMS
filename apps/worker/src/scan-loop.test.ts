/**
 * Protocol parse scan loop tests — Phase 3 Task 3.3.
 *
 * Uses an in-memory fake Prisma so we can verify that scanProtocolQueue:
 *   - picks rows where parseStatus=Parsing
 *   - writes AIProtocolParseResult + AIOutput + AICallLog
 *   - flips parseStatus to Parsed on success / ParseFailed on error
 *
 * The fake Prisma records every call so tests can assert side-effects
 * without spinning up a real Postgres. The end-to-end worker loop
 * (setInterval cadence, shutdown wiring) is exercised by index.test.ts.
 */
import { describe, it, expect } from "vitest";
import { HumanConfirmationStatus, ProtocolParseStatus } from "@aic-dct/domain";
import { scanProtocolQueue } from "./scan-loop.js";

type Row = {
  id: string;
  projectId: string;
  version: string;
  documentUrl: string;
  parseStatus: ProtocolParseStatus;
};

interface FakePrisma {
  protocolVersion: {
    rows: Row[];
    findManyCalls: Array<{ where: { parseStatus: ProtocolParseStatus } }>;
    updateCalls: Array<{ where: { id: string }; data: { parseStatus: ProtocolParseStatus } }>;
  };
  promptTemplate: { rows: Array<{ id: string; code: string; version: string }> };
  aIOutput: { created: Array<Record<string, unknown>> };
  aICallLog: { created: Array<Record<string, unknown>> };
  aIProtocolParseResult: { created: Array<Record<string, unknown>> };
}

function buildFakePrisma(): FakePrisma {
  return {
    protocolVersion: {
      rows: [],
      findManyCalls: [],
      updateCalls: [],
    },
    promptTemplate: { rows: [] },
    aIOutput: { created: [] },
    aICallLog: { created: [] },
    aIProtocolParseResult: { created: [] },
  };
}

/**
 * Hand-rolled Prisma facade — the scan loop only uses these six methods,
 * and the fake just records inputs and returns synthetic rows. The shape
 * mirrors what Prisma's generated client returns so we don't need any
 * special-casing in the production code.
 */
function buildFacade(fake: FakePrisma): unknown {
  return {
    protocolVersion: {
      findMany: async (args: { where: { parseStatus: ProtocolParseStatus } }) => {
        fake.protocolVersion.findManyCalls.push(args);
        return fake.protocolVersion.rows.filter(
          (r) => r.parseStatus === args.where.parseStatus,
        );
      },
      update: async (args: { where: { id: string }; data: { parseStatus: ProtocolParseStatus } }) => {
        fake.protocolVersion.updateCalls.push(args);
        const row = fake.protocolVersion.rows.find((r) => r.id === args.where.id);
        if (!row) throw new Error(`no row ${args.where.id}`);
        row.parseStatus = args.data.parseStatus;
        return row;
      },
    },
    promptTemplate: {
      findFirst: async (args: { where: { code: string } }) => {
        return fake.promptTemplate.rows.find((r) => r.code === args.where.code) ?? null;
      },
      create: async (args: { data: { code: string; version: string; body: string; variables: string[]; outputKind: string } }) => {
        const row = { id: `prompt-${fake.promptTemplate.rows.length + 1}`, ...args.data };
        fake.promptTemplate.rows.push(row);
        return row;
      },
    },
    aIOutput: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = { id: `output-${fake.aIOutput.created.length + 1}`, ...args.data };
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
    aIProtocolParseResult: {
      create: async (args: { data: Record<string, unknown> }) => {
        fake.aIProtocolParseResult.created.push(args.data);
        return args.data;
      },
    },
  };
}

describe("scanProtocolQueue", () => {
  it("returns zeroed summary when nothing is Parsing", async () => {
    const fake = buildFakePrisma();
    const prisma = buildFacade(fake) as Parameters<typeof scanProtocolQueue>[0];
    const summary = await scanProtocolQueue(prisma);
    expect(summary).toEqual({ scanned: 0, parsed: 0, failed: 0 });
    expect(fake.aIOutput.created).toHaveLength(0);
  });

  it("parses every row in Parsing and writes AI artifacts", async () => {
    const fake = buildFakePrisma();
    fake.protocolVersion.rows = [
      {
        id: "v-1",
        projectId: "p-1",
        version: "v1.0",
        documentUrl: "https://files.example.test/v1.pdf",
        parseStatus: ProtocolParseStatus.Parsing,
      },
      {
        id: "v-2",
        projectId: "p-1",
        version: "v2.0",
        documentUrl: "https://files.example.test/v2.pdf",
        parseStatus: ProtocolParseStatus.Parsing,
      },
    ];
    const prisma = buildFacade(fake) as Parameters<typeof scanProtocolQueue>[0];
    const summary = await scanProtocolQueue(prisma);
    expect(summary.scanned).toBe(2);
    expect(summary.parsed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(fake.aIOutput.created).toHaveLength(2);
    expect(fake.aIProtocolParseResult.created).toHaveLength(2);
    expect(fake.aICallLog.created).toHaveLength(2);
    expect(fake.promptTemplate.rows).toHaveLength(1);
    // Rows flipped to Parsed.
    expect(fake.protocolVersion.rows.every((r) => r.parseStatus === ProtocolParseStatus.Parsed)).toBe(true);
    // Pending confirmation state — human gate is intact.
    expect(fake.aIProtocolParseResult.created[0]?.status).toBe(HumanConfirmationStatus.Pending);
  });

  it("flips ParseFailed when the provider throws, leaving summary.failed=1", async () => {
    const fake = buildFakePrisma();
    fake.protocolVersion.rows = [
      {
        id: "v-bad",
        projectId: "p-1",
        version: "v0",
        documentUrl: "https://files.example.test/bad.pdf",
        parseStatus: ProtocolParseStatus.Parsing,
      },
    ];
    const prisma = buildFacade(fake) as Parameters<typeof scanProtocolQueue>[0];
    const summary = await scanProtocolQueue(prisma, {
      parseProtocol: async () => {
        throw new Error("mock provider boom");
      },
      scanRisk: async () => ({ suggestion: "x", confidence: 0.5, confidenceLevel: "Low" }),
    });
    expect(summary.failed).toBe(1);
    expect(summary.parsed).toBe(0);
    expect(fake.protocolVersion.rows[0]?.parseStatus).toBe(ProtocolParseStatus.ParseFailed);
  });

  it("inputHash is deterministic for the same documentUrl + version", async () => {
    const fake = buildFakePrisma();
    fake.protocolVersion.rows = [
      {
        id: "v-1",
        projectId: "p-1",
        version: "v1",
        documentUrl: "https://files.example.test/same.pdf",
        parseStatus: ProtocolParseStatus.Parsing,
      },
    ];
    const prisma = buildFacade(fake) as Parameters<typeof scanProtocolQueue>[0];
    await scanProtocolQueue(prisma);
    const fake2 = buildFakePrisma();
    fake2.protocolVersion.rows = [
      {
        id: "v-2",
        projectId: "p-1",
        version: "v1",
        documentUrl: "https://files.example.test/same.pdf",
        parseStatus: ProtocolParseStatus.Parsing,
      },
    ];
    const prisma2 = buildFacade(fake2) as Parameters<typeof scanProtocolQueue>[0];
    await scanProtocolQueue(prisma2);
    expect(fake.aICallLog.created[0]?.inputHash).toBe(fake2.aICallLog.created[0]?.inputHash);
  });
});