import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Minimal key/value store used to share the demo state between server
 * instances. Values are strings; a `get` miss and a failed read both return
 * null (the Vercel Runtime Cache client reports errors that way), so callers
 * treat null as "maybe missing" and retry before acting on it.
 */
export interface KvStore {
  readonly kind: "vercel-runtime-cache" | "file";
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Stable, URL-safe cache key (the client's default 32-bit hash could collide). */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 48);
}

/**
 * Vercel Runtime Cache: a regional cache shared by every function instance of
 * the deployment. It is ephemeral (LRU eviction, TTL), so the sync layer
 * re-publishes from memory when an entry disappears.
 */
export async function createVercelRuntimeCacheStore(): Promise<KvStore> {
  const { getCache } = await import("@vercel/functions");
  const cache = getCache({ namespace: "poigacha", keyHashFunction: hashKey });
  return {
    kind: "vercel-runtime-cache",
    async get(key) {
      const value = await cache.get(key);
      return typeof value === "string" ? value : null;
    },
    async set(key, value, ttlSeconds) {
      await cache.set(key, value, { ttl: ttlSeconds });
    },
    async delete(key) {
      await cache.delete(key);
    },
  };
}

/**
 * Files in a local directory. Lets several `next start` processes on one machine
 * share state (and is how the multi-instance behaviour is tested locally).
 * `faultRate` (0–1) makes reads miss and writes get dropped at random, the same
 * failure modes as a best-effort cache.
 */
export function createFileStore(dir: string, faultRate = 0): KvStore {
  const fileOf = (key: string) => path.join(dir, `${hashKey(key)}.json`);
  const fault = () => faultRate > 0 && Math.random() < faultRate;
  return {
    kind: "file",
    async get(key) {
      if (fault()) return null;
      try {
        const entry = JSON.parse(await readFile(fileOf(key), "utf8")) as { value: string; expiresAt: number };
        return entry.expiresAt > Date.now() ? entry.value : null;
      } catch {
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      if (fault()) return;
      await mkdir(dir, { recursive: true });
      const file = fileOf(key);
      const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
      await writeFile(tmp, JSON.stringify({ key, value, expiresAt: Date.now() + ttlSeconds * 1000 }));
      await rename(tmp, file);
    },
    async delete(key) {
      await rm(fileOf(key), { force: true });
    },
  };
}
