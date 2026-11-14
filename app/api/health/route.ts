import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis";
import { ok } from "@/lib/http";

export async function GET() {
  let dbStatus = "down";
  let redisStatus = "memory-fallback";

  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "up";
  } catch {
    dbStatus = "error";
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const pong = await redis.ping();
      if (pong === "PONG") redisStatus = "up";
    } catch {
      redisStatus = "memory-fallback";
    }
  }

  return ok({
    status: dbStatus === "up" ? "healthy" : "degraded",
    services: { postgres: dbStatus, redis: redisStatus },
    timestamp: new Date().toISOString(),
  });
}
