import crypto from "crypto";
import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redisClient?: Redis | null;
  memoryStore?: Map<string, { value: string; expiresAt: number }>;
};

function getMemoryStore() {
  if (!globalForRedis.memoryStore) {
    globalForRedis.memoryStore = new Map();
  }
  return globalForRedis.memoryStore;
}

export function getRedisClient(): Redis | null {
  if (globalForRedis.redisClient !== undefined) {
    return globalForRedis.redisClient;
  }

  if (!env.redisUrl || process.env.DISABLE_REDIS === "true") {
    globalForRedis.redisClient = null;
    return null;
  }

  try {
    const client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) return null;
        return 100;
      },
    });
    client.on("error", () => {
      // Fallback to in-memory store automatically when Redis isn't reachable
    });
    globalForRedis.redisClient = client;
    return client;
  } catch {
    globalForRedis.redisClient = null;
    return null;
  }
}

async function memGet(key: string): Promise<string | null> {
  const entry = getMemoryStore().get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    getMemoryStore().delete(key);
    return null;
  }
  return entry.value;
}

async function memSet(key: string, value: string, ttlSeconds: number) {
  getMemoryStore().set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `rl:${bucket}:${identifier}`;
  const now = Date.now();
  const client = getRedisClient();

  if (client) {
    try {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }
      const ttl = await client.ttl(key);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: now + Math.max(ttl, 1) * 1000,
      };
    } catch {
      // Fall through to memory store
    }
  }

  const existing = await memGet(key);
  const current = existing ? Number(existing) + 1 : 1;
  await memSet(key, String(current), windowSeconds);
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    resetAt: now + windowSeconds * 1000,
  };
}

export async function withDistributedLock<T>(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const key = `lock:${lockKey}`;
  const token = crypto.randomUUID();
  const client = getRedisClient();

  if (client) {
    try {
      const acquired = await client.set(key, token, "EX", ttlSeconds, "NX");
      if (!acquired) {
        throw new Error("RESOURCE_LOCKED");
      }
      try {
        return await fn();
      } finally {
        const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
        await client.eval(script, 1, key, token).catch(() => {});
      }
    } catch (err) {
      if (err instanceof Error && err.message === "RESOURCE_LOCKED") {
        throw err;
      }
      // Fall back to in-memory lock if Redis threw a connection error
    }
  }

  const existing = await memGet(key);
  if (existing) {
    throw new Error("RESOURCE_LOCKED");
  }
  await memSet(key, token, ttlSeconds);
  try {
    return await fn();
  } finally {
    if ((await memGet(key)) === token) {
      getMemoryStore().delete(key);
    }
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const client = getRedisClient();

  if (client) {
    try {
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      const fresh = await fetcher();
      await client.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
      return fresh;
    } catch {
      // Fallback to direct fetch + memory cache
    }
  }

  const memCached = await memGet(key);
  if (memCached) {
    return JSON.parse(memCached) as T;
  }
  const fresh = await fetcher();
  await memSet(key, JSON.stringify(fresh), ttlSeconds);
  return fresh;
}

export async function invalidateCachePrefix(prefix: string): Promise<void> {
  const client = getRedisClient();
  if (client) {
    try {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Ignore Redis errors on cache invalidation
    }
  }

  const store = getMemoryStore();
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export async function closeRedisConnection() {
  const client = globalForRedis.redisClient;
  if (client) {
    client.disconnect();
    globalForRedis.redisClient = null;
  }
}
