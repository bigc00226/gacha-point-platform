import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { cookies } from "next/headers";
import { cache } from "react";
import { withLock } from "../lock";
import { getDb, installDb, peekDb, resetDb, SCHEMA_VERSION, type Db } from "../store";
import { decodeBytes, decodeDb, encodeBytes, encodeDb, splitChunks } from "./codec";
import { createFileStore, createVercelRuntimeCacheStore, type KvStore } from "./kv";

/**
 * Keeps the in-memory demo database consistent across server instances.
 *
 * With a single long-running process (`next start`, Render, a VPS) this is a
 * no-op. On Vercel, requests are spread over function instances that don't
 * share memory, so the database is mirrored to the Vercel Runtime Cache:
 *
 * - Every request first reads the shared "head" (epoch + version, ~150 bytes)
 *   and downloads the snapshot only when this instance is behind.
 * - Every write request runs on the latest state, then publishes a new
 *   snapshot and head. If another instance published in between (optimistic
 *   concurrency), this attempt's changes are discarded and the request re-runs
 *   on the newer state, so no update is silently lost.
 * - The cache is best-effort (entries can expire or be evicted, and the client
 *   reports errors as misses), so reads are retried, writes are verified, and an
 *   instance that still holds the data re-publishes it.
 *
 * The `pg_sv` cookie carries the version a browser last wrote, so its next page
 * view waits until that version is visible (read-your-writes).
 */

export type StateMode = "memory" | "vercel-runtime-cache" | "file";

interface Head {
  epoch: string;
  version: number;
  /** Unique per publish: two instances racing for the same version never share snapshot keys. */
  id: string;
  /** The snapshot this one replaced (deleted one version later, once no reader can still need it). */
  prev: { id: string; chunks: number } | null;
  chunks: number;
  size: number;
  savedAt: string;
  schema: number;
}
type HeadRef = Pick<Head, "epoch" | "version">;

const STATE_LOCK = "state:sync";
export const STATE_HINT_COOKIE = "pg_sv";
const TTL_SECONDS = 7 * 24 * 60 * 60;
/** Stays well under the Runtime Cache item limit (2 MB). */
const CHUNK_CHARS = 1_000_000;
const MAX_ATTEMPTS = 3;
/** Write requests that lose a race re-run on the newer state (with jittered backoff). */
const MAX_WRITE_ATTEMPTS = 6;

interface LocalState {
  /** Shared state this process's database corresponds to (null until the first sync). */
  head: Head | null;
  /** The local database has changes that were not published (a failed attempt). */
  dirty: boolean;
  persistedMedia: Set<string>;
  lastError: string | null;
  lastErrorAt: string | null;
  storePromise: Promise<KvStore | null> | null;
  scope: AsyncLocalStorage<{ writing: boolean }>;
}

type SyncGlobal = typeof globalThis & { __poigachaSync?: LocalState };
const local: LocalState = ((globalThis as SyncGlobal).__poigachaSync ??= {
  head: null,
  dirty: false,
  persistedMedia: new Set(),
  lastError: null,
  lastErrorAt: null,
  storePromise: null,
  scope: new AsyncLocalStorage(),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * POIGACHA_STATE_STORE: "auto" (default: Vercel Runtime Cache on Vercel, memory
 * elsewhere), "memory", "vercel", or "file" (POIGACHA_STATE_DIR; for running
 * several local processes against one state).
 */
export function stateMode(): StateMode {
  const setting = (process.env.POIGACHA_STATE_STORE ?? "auto").trim().toLowerCase();
  if (setting === "memory") return "memory";
  if (setting === "file") return "file";
  if (setting === "vercel") return "vercel-runtime-cache";
  return process.env.VERCEL === "1" ? "vercel-runtime-cache" : "memory";
}

export function statePersistenceEnabled(): boolean {
  return stateMode() !== "memory";
}

/** Each deployment (and schema) gets its own state, so a redeploy starts from the seed. */
function namespace(): string {
  const deployment =
    process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || process.env.POIGACHA_STATE_NAMESPACE || "local";
  return `${deployment}:schema${SCHEMA_VERSION}`;
}

const keys = {
  head: () => `${namespace()}:head`,
  snapshot: (id: string, chunk: number) => `${namespace()}:snapshot:${id}:${chunk}`,
  mediaManifest: (id: string) => `${namespace()}:media:${id}`,
  mediaChunk: (id: string, chunk: number) => `${namespace()}:media:${id}:${chunk}`,
};

function getStore(): Promise<KvStore | null> {
  const mode = stateMode();
  if (mode === "memory") return Promise.resolve(null);
  local.storePromise ??= (async () => {
    try {
      if (mode === "file") {
        const dir = process.env.POIGACHA_STATE_DIR || path.join(tmpdir(), "poigacha-state");
        return createFileStore(dir, Number(process.env.POIGACHA_STATE_FAULT_RATE) || 0);
      }
      return await createVercelRuntimeCacheStore();
    } catch (err) {
      recordError("共有ストアを初期化できませんでした（このインスタンスのメモリのみで動作します）", err);
      return null;
    }
  })();
  return local.storePromise;
}

function recordError(message: string, err?: unknown): void {
  local.lastError = err instanceof Error ? `${message}: ${err.message}` : message;
  local.lastErrorAt = new Date().toISOString();
  console.error(`[state] ${message}`, err ?? "");
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const newEpoch = () => randomBytes(6).toString("hex");
const sameHead = (a: Head | null, b: Head | null) => (a === null || b === null ? a === b : a.id === b.id);

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function parseHead(raw: string | null): Head | null {
  if (!raw) return null;
  try {
    const head = JSON.parse(raw) as Partial<Head>;
    if (
      typeof head.epoch === "string" &&
      typeof head.id === "string" &&
      Number.isInteger(head.version) &&
      Number.isInteger(head.chunks) &&
      typeof head.size === "number" &&
      head.schema === SCHEMA_VERSION
    ) {
      return head as Head;
    }
  } catch {
    // Treated as missing.
  }
  return null;
}

/** A miss may be a transient read error, so it is retried before being believed. */
async function readHead(store: KvStore, attempts = 3): Promise<Head | null> {
  for (let i = 0; i < attempts; i++) {
    const head = parseHead(await store.get(keys.head()));
    if (head) return head;
    if (i < attempts - 1) await sleep(30 * (i + 1));
  }
  return null;
}

/** Reads several entries, retrying misses (they may be transient read errors). Null if any stays missing. */
async function readAll(store: KvStore, entryKeys: string[]): Promise<string[] | null> {
  const values: Array<string | null> = entryKeys.map(() => null);
  for (let attempt = 0; attempt < 4; attempt++) {
    await Promise.all(
      values.map(async (value, i) => {
        if (value === null) values[i] = await store.get(entryKeys[i]);
      }),
    );
    if (values.every((value) => value !== null)) return values as string[];
    await sleep(50 * 2 ** attempt);
  }
  return null;
}

async function readSnapshot(store: KvStore, head: Head): Promise<Db | null> {
  const parts = await readAll(store, Array.from({ length: head.chunks }, (_, i) => keys.snapshot(head.id, i)));
  if (!parts) return null;
  const encoded = parts.join("");
  if (encoded.length !== head.size) return null;
  try {
    return decodeDb(encoded);
  } catch (err) {
    recordError("共有スナップショットを読み込めませんでした", err);
    return null;
  }
}

/** Read-your-writes: give the store a moment to show the version this browser just wrote. */
async function waitForVersion(store: KvStore, hint: HeadRef, head: Head): Promise<Head> {
  let current = head;
  for (let i = 0; i < 6 && current.epoch === hint.epoch && current.version < hint.version; i++) {
    await sleep(60);
    current = (await readHead(store, 1)) ?? current;
  }
  return current;
}

function install(db: Db, head: Head): void {
  // Media bytes are immutable per id: keep what this instance already downloaded.
  const previous = peekDb();
  if (previous) for (const [id, bytes] of previous.mediaBlobs) if (db.media.has(id)) db.mediaBlobs.set(id, bytes);
  installDb(db);
  local.head = head;
  local.dirty = false;
  local.persistedMedia = new Set([...db.media.values()].filter((m) => m.source === "upload").map((m) => m.id));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

type PublishResult =
  | { ok: true; head: Head }
  /** `attempted`: the head this publish wrote, when it is unclear whether that write landed. */
  | { ok: false; reason: "conflict" | "unverified"; attempted?: Head };

/**
 * Writes entries and reads them back: the cache client reports a failed write as
 * success, and a head must never point at data that did not land.
 */
async function writeVerified(store: KvStore, entries: Array<[key: string, value: string]>): Promise<boolean> {
  let pending = entries;
  for (let attempt = 0; attempt < 3 && pending.length > 0; attempt++) {
    await Promise.all(pending.map(([key, value]) => store.set(key, value, TTL_SECONDS)));
    const readBack = await Promise.all(pending.map(([key]) => store.get(key)));
    pending = pending.filter(([, value], i) => readBack[i] !== value);
  }
  return pending.length === 0;
}

class UnverifiedWriteError extends Error {}

/** Uploaded files are stored once, as their own entries (they never change). */
async function persistMedia(store: KvStore, db: Db): Promise<void> {
  for (const [id, bytes] of db.mediaBlobs) {
    if (local.persistedMedia.has(id) || !db.media.has(id)) continue;
    const chunks = splitChunks(encodeBytes(bytes), CHUNK_CHARS);
    const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const ok =
      (await writeVerified(store, chunks.map((chunk, i) => [keys.mediaChunk(id, i), chunk]))) &&
      (await writeVerified(store, [[keys.mediaManifest(id), JSON.stringify({ chunks: chunks.length, size })]]));
    if (!ok) throw new UnverifiedWriteError("アップロードされたファイルを保存できませんでした");
    local.persistedMedia.add(id);
  }
  for (const id of [...local.persistedMedia]) {
    if (db.media.has(id)) continue;
    local.persistedMedia.delete(id);
    await store.delete(keys.mediaManifest(id));
  }
}

/**
 * Publishes this instance's database as the next version, provided the shared
 * head is still `expected` (null = no shared state yet).
 */
async function publish(store: KvStore, expected: Head | null): Promise<PublishResult> {
  const db = getDb();
  await persistMedia(store, db);
  const payload = encodeDb(db);
  const chunks = splitChunks(payload, CHUNK_CHARS);
  const epoch = expected?.epoch ?? local.head?.epoch ?? newEpoch();
  const version = Math.max(expected?.version ?? 0, local.head?.epoch === epoch ? local.head.version : 0) + 1;
  const head: Head = {
    epoch,
    version,
    id: randomBytes(8).toString("hex"),
    prev: expected ? { id: expected.id, chunks: expected.chunks } : null,
    chunks: chunks.length,
    size: payload.length,
    savedAt: new Date().toISOString(),
    schema: SCHEMA_VERSION,
  };
  if (!(await writeVerified(store, chunks.map((chunk, i) => [keys.snapshot(head.id, i), chunk])))) {
    return { ok: false, reason: "unverified" };
  }

  // Switch the head only if nobody else published in the meantime.
  const current = await readHead(store);
  if (!sameHead(current, expected)) {
    await deleteSnapshot(store, head.id, head.chunks);
    return { ok: false, reason: "conflict" };
  }
  await store.set(keys.head(), JSON.stringify(head), TTL_SECONDS);

  // The cache client swallows write errors, so confirm the switch took effect.
  const written = await readHead(store);
  if (!written || written.id !== head.id) {
    // Another instance may already have published on top of this version: then it landed.
    if (written?.prev?.id !== head.id) {
      return written ? { ok: false, reason: "conflict" } : { ok: false, reason: "unverified", attempted: head };
    }
  }

  local.head = head;
  local.dirty = false;
  // Keep the snapshot we replaced (readers may have just seen the previous head);
  // the one before it is no longer reachable.
  if (expected?.prev) await deleteSnapshot(store, expected.prev.id, expected.prev.chunks);
  return { ok: true, head };
}

async function deleteSnapshot(store: KvStore, id: string, chunks: number): Promise<void> {
  try {
    await Promise.all(Array.from({ length: chunks }, (_, i) => store.delete(keys.snapshot(id, i))));
  } catch {
    // Entries expire on their own.
  }
}

// ---------------------------------------------------------------------------
// Synchronisation (callers hold STATE_LOCK)
// ---------------------------------------------------------------------------

type SyncStatus = "ok" | "degraded";

async function syncUnlocked(store: KvStore, hint: HeadRef | null): Promise<SyncStatus> {
  for (let round = 0; round < MAX_ATTEMPTS; round++) {
    let head = await readHead(store);
    if (head && hint && hint.epoch === head.epoch && hint.version > head.version) head = await waitForVersion(store, hint, head);

    if (!head) {
      // First request of this deployment, or the shared entry expired: publish what this instance has.
      if (local.dirty) return "degraded";
      if ((await publish(store, null)).ok) return "ok";
      continue;
    }

    const mine = local.head;
    if (mine && !local.dirty && peekDb()) {
      if (mine.id === head.id) return "ok";
      if (mine.epoch === head.epoch && mine.version > head.version) {
        // The shared copy is older than ours (it was evicted and rebuilt from an older copy): restore ours.
        if ((await publish(store, head)).ok) return "ok";
        continue;
      }
    }

    const db = await readSnapshot(store, head);
    if (db) {
      install(db, head);
      return "ok";
    }

    // The head points at a snapshot that is gone. Re-publish the newest data this
    // instance holds; an instance without data starts over from the seed.
    if (local.dirty) return "degraded";
    if (!mine || !peekDb()) {
      resetDb();
      local.persistedMedia = new Set();
    }
    if ((await publish(store, head)).ok) return "ok";
  }
  return "degraded";
}

/** True when `attempted` is (or was just superseded as) the shared head. */
async function landed(store: KvStore, attempted: Head): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const current = await readHead(store);
    if (current) return current.id === attempted.id || current.prev?.id === attempted.id;
    await sleep(100 * (i + 1));
  }
  return false;
}

async function syncSafely(store: KvStore, hint: HeadRef | null): Promise<SyncStatus> {
  try {
    return await syncUnlocked(store, hint);
  } catch (err) {
    recordError("共有ストアとの同期に失敗しました", err);
    return "degraded";
  }
}

async function publishSafely(store: KvStore, expected: Head | null): Promise<PublishResult> {
  try {
    return await publish(store, expected);
  } catch (err) {
    if (!(err instanceof UnverifiedWriteError)) recordError("共有ストアへの保存に失敗しました", err);
    return { ok: false, reason: "unverified" };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function parseHint(value: string | undefined | null): HeadRef | null {
  const match = value ? /^([0-9a-f]{6,32})\.(\d{1,12})$/.exec(value) : null;
  return match ? { epoch: match[1], version: Number(match[2]) } : null;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function withHintCookie(res: Response, head: Head, req: Request): Response {
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  // Only needed for the next few page views after a write.
  const cookie = `${STATE_HINT_COOKIE}=${head.epoch}.${head.version}; Path=/; Max-Age=30; SameSite=Lax; HttpOnly${secure ? "; Secure" : ""}`;
  try {
    res.headers.append("Set-Cookie", cookie);
    return res;
  } catch {
    // Immutable headers (e.g. Response.redirect): copy the response.
    const copy = new Response(res.body, res);
    copy.headers.append("Set-Cookie", cookie);
    return copy;
  }
}

function unavailable(): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code: "STATE_UNAVAILABLE",
        message: "アクセスが集中しているため、操作を保存できませんでした。少し時間をおいてもう一度お試しください。",
      },
    },
    { status: 503, headers: { "Retry-After": "1" } },
  );
}

/** Bring this instance up to date with the shared state (no-op without a shared store). */
export async function syncState(hint: HeadRef | null = null): Promise<void> {
  const store = await getStore();
  if (!store || local.scope.getStore()) return;
  await withLock(STATE_LOCK, () => syncSafely(store, hint));
}

/**
 * Server Components: sync once per request before reading data. Pages call this
 * (directly or through getCurrentUser) before touching the database.
 */
export const syncRequestState = cache(async (): Promise<void> => {
  if (!statePersistenceEnabled() || local.scope.getStore()) return;
  let hint: HeadRef | null = null;
  try {
    hint = parseHint((await cookies()).get(STATE_HINT_COOKIE)?.value);
  } catch {
    // Not inside a request.
  }
  await syncState(hint);
});

/**
 * Route Handlers (via `route()`): reads sync first; writes run on the latest state
 * and are published afterwards, re-running on a newer state after a conflict.
 */
export async function withRequestState(
  req: Request,
  writes: boolean,
  run: (req: Request) => Promise<Response>,
): Promise<Response> {
  const store = await getStore();
  if (!store || local.scope.getStore()) return run(req);
  const hint = parseHint(readCookie(req.headers.get("cookie"), STATE_HINT_COOKIE));

  if (!writes) {
    await withLock(STATE_LOCK, () => syncSafely(store, hint));
    return local.scope.run({ writing: false }, () => run(req));
  }

  // A pristine copy of the request, so the body can be read again on a retry.
  const template = req.clone();
  return withLock(STATE_LOCK, () =>
    local.scope.run({ writing: true }, async () => {
      for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
        if (attempt > 1) await sleep(10 + Math.random() * 40 * attempt);
        if ((await syncSafely(store, attempt === 1 ? hint : null)) === "degraded") continue;
        const expected = local.head;
        const res = await run(attempt === 1 ? req : template.clone());
        const result = await publishSafely(store, expected);
        if (result.ok) return withHintCookie(res, result.head, req);
        // The confirming read failed: before re-running, check whether the write landed after all
        // (re-running a request that was committed would apply it twice).
        if (result.attempted && (await landed(store, result.attempted))) {
          local.head = result.attempted;
          local.dirty = false;
          return withHintCookie(res, result.attempted, req);
        }
        // Lost a race (or the write could not be confirmed): drop this attempt's
        // changes and re-run the request on the latest shared state.
        local.dirty = true;
        local.head = null;
      }
      return unavailable();
    }),
  );
}

/** Uploaded media bytes are fetched from the shared store the first time this instance serves them. */
export async function ensureMediaBytes(id: string): Promise<void> {
  const db = getDb();
  if (db.mediaBlobs.has(id) || db.media.get(id)?.source !== "upload") return;
  const store = await getStore();
  if (!store) return;
  try {
    const [rawManifest] = (await readAll(store, [keys.mediaManifest(id)])) ?? [null];
    const manifest = JSON.parse(rawManifest ?? "null") as { chunks: number; size: number } | null;
    if (!manifest || !Number.isInteger(manifest.chunks)) return;
    const parts = await readAll(store, Array.from({ length: manifest.chunks }, (_, i) => keys.mediaChunk(id, i)));
    if (!parts) return;
    const encoded = parts.join("");
    if (encoded.length !== manifest.size) return;
    getDb().mediaBlobs.set(id, decodeBytes(encoded));
    local.persistedMedia.add(id);
  } catch (err) {
    recordError("アップロードされたファイルを読み込めませんでした", err);
  }
}

export interface StateStatus {
  mode: StateMode;
  shared: boolean;
  label: string;
  version: number | null;
  savedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export function stateStatus(): StateStatus {
  const mode = stateMode();
  return {
    mode,
    shared: mode !== "memory",
    label:
      mode === "vercel-runtime-cache"
        ? "Vercel Runtime Cache（全インスタンスで共有）"
        : mode === "file"
          ? "ローカルファイル（複数プロセスで共有）"
          : "このサーバーのメモリ",
    version: local.head?.version ?? null,
    savedAt: local.head?.savedAt ?? null,
    lastError: local.lastError,
    lastErrorAt: local.lastErrorAt,
  };
}
