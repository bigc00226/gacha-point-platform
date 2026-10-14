import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Db } from "../store";

/**
 * Snapshot codec: Db ⇄ compact string (JSON → gzip → base64).
 *
 * Maps and Sets only appear as top-level collections of `Db`, so they are
 * converted there (a JSON replacer/reviver walking every value is several
 * times slower). Uploaded media bytes (`mediaBlobs`) are stored separately,
 * one entry per file, so the snapshot stays small enough to rewrite after
 * every change (~1.6 MB of JSON → ~0.3 MB encoded for the seed data).
 */
type Encoded = { kind: "map"; entries: Array<[unknown, unknown]> } | { kind: "set"; values: unknown[] } | { kind: "value"; value: unknown };

const SKIP: ReadonlySet<string> = new Set(["mediaBlobs"]);

export function encodeDb(db: Db): string {
  const plain: Record<string, Encoded> = {};
  for (const [key, value] of Object.entries(db)) {
    if (SKIP.has(key)) continue;
    plain[key] =
      value instanceof Map
        ? { kind: "map", entries: [...value] }
        : value instanceof Set
          ? { kind: "set", values: [...value] }
          : { kind: "value", value };
  }
  return gzipSync(JSON.stringify(plain), { level: 3 }).toString("base64");
}

export function decodeDb(encoded: string): Db {
  const plain = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8")) as Record<string, Encoded>;
  const db: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(plain)) {
    db[key] = item.kind === "map" ? new Map(item.entries) : item.kind === "set" ? new Set(item.values) : item.value;
  }
  db.mediaBlobs = new Map();
  return db as unknown as Db;
}

export function encodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

export function decodeBytes(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, "base64"));
}

/** Splits a string into pieces that fit one store item (the Vercel Runtime Cache limit is 2 MB per item). */
export function splitChunks(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}
