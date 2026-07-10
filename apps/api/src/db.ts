import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client instance per API process. Phase 1 lazily creates
 * the client; Phase 2 may switch to per-request transactions.
 */
let _client: PrismaClient | undefined;

export function prisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient();
  }
  return _client;
}

export async function disconnectPrisma(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = undefined;
  }
}
