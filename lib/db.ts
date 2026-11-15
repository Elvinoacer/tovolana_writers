import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import neonConfig from "../neon";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prisma?: PrismaClient;
};

function resolveConnectionString(): string | undefined {
  if (process.env.DATABASE_URL) {
    return parseEnv(neonConfig, ["DATABASE_URL"]).postgres.databaseUrl;
  }
  return process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = resolveConnectionString();

  if (!globalForPrisma.prismaPool) {
    const pool = new Pool(
      connectionString
        ? { connectionString, max: 10, connectionTimeoutMillis: 15_000 }
        : { max: 10, connectionTimeoutMillis: 15_000 }
    );
    attachDatabasePool(pool);
    globalForPrisma.prismaPool = pool;
  }

  const adapter = new PrismaPg(globalForPrisma.prismaPool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function closeDbConnections() {
  await db.$disconnect();
  if (globalForPrisma.prismaPool) {
    await globalForPrisma.prismaPool.end();
  }
}
