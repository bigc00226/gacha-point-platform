import "server-only";

/**
 * Keyed async mutex.
 *
 * Every balance / stock / slot mutation runs inside `withLocks([...keys])`, which
 * serializes concurrent requests touching the same rows. In production this maps
 * to a DB transaction with `SELECT ... FOR UPDATE` (or a Redis lock); in the demo
 * the data is in memory, so an in-process promise chain gives the same guarantee.
 *
 * Keys are acquired in sorted order, so two requests that need the same set of
 * locks can never deadlock each other.
 */
type LockGlobal = typeof globalThis & { __poigachaLocks?: Map<string, Promise<void>> };
const g = globalThis as LockGlobal;
const locks: Map<string, Promise<void>> = (g.__poigachaLocks ??= new Map());

async function acquire(key: string): Promise<() => void> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  locks.set(key, tail);
  await previous;
  return () => {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  };
}

export async function withLocks<T>(keys: string[], fn: () => Promise<T> | T): Promise<T> {
  const ordered = [...new Set(keys)].sort();
  const releases: Array<() => void> = [];
  try {
    for (const key of ordered) releases.push(await acquire(key));
    return await fn();
  } finally {
    for (const release of releases.reverse()) release();
  }
}

export function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  return withLocks([key], fn);
}

/** Lock key helpers so every module uses the same names. */
export const lockKeys = {
  user: (id: string) => `user:${id}`,
  gacha: (id: string) => `gacha:${id}`,
  coupon: (id: string) => `coupon:${id}`,
  exchangeItem: (id: string) => `item:${id}`,
  userPrize: (id: string) => `prize:${id}`,
  order: (id: string) => `order:${id}`,
  transaction: (provider: string, txId: string) => `tx:${provider}:${txId}`,
};
