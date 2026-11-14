import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!globalForPrisma.prismaPool) {
    globalForPrisma.prismaPool = new Pool(
      connectionString ? { connectionString, max: 10 } : { max: 10 }
    );
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
