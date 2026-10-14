import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@/lib/types";
import { ApiError } from "./http";
import { syncRequestState } from "./state/sync";
import { getDb } from "./store";

/**
 * Stateless signed session cookie: "<userId>.<expiresAtEpochSec>.<HMAC-SHA256>".
 * HttpOnly + SameSite=Lax; Secure when served over HTTPS.
 */
export const SESSION_COOKIE = "pg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function sessionSecret(): string {
  return process.env.SESSION_SECRET || "poigacha-demo-session-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, nowMs: number = Date.now()): string {
  const payload = `${userId}.${Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string, nowMs: number = Date.now()): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const given = Buffer.from(token.slice(lastDot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [userId, exp] = payload.split(".");
  if (!userId || !exp || Number(exp) * 1000 < nowMs) return null;
  return userId;
}

/** Route Handlers only (cookies can't be set while rendering). */
export async function setSessionCookie(userId: string, secure: boolean): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * The signed-in, active user — or null. Pages call this before reading data, so
 * it also brings this server instance up to date with the shared state.
 */
export async function getCurrentUser(): Promise<User | null> {
  await syncRequestState();
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = getDb().users.get(userId);
  if (!user || user.status !== "active") return null;
  return user;
}

/** Pages: redirect to /login (and back to `nextPath` afterwards) when signed out. */
export async function requireUser(nextPath = "/"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Admin pages: signed-out → /login, non-admin → top page. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/?forbidden=1");
  return user;
}

/** Route Handlers: 401 when signed out. */
export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ログインが必要です。ログインしてから再度お試しください。");
  return user;
}

/** Route Handlers: 403 for non-admins. */
export async function requireApiAdmin(): Promise<User> {
  const user = await requireApiUser();
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "管理者権限が必要です");
  return user;
}

// --- Login throttling: 5 failures for the same email → locked for 60 seconds ---
// (Kept in the database so every server instance applies the same lock.)

export function assertLoginAllowed(email: string): void {
  const entry = getDb().loginFailures.get(email);
  if (entry && entry.lockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw new ApiError(429, "RATE_LIMITED", `ログインの試行回数が上限に達しました。${seconds}秒後に再度お試しください。`);
  }
}

export function recordLoginFailure(email: string): void {
  const loginFailures = getDb().loginFailures;
  const entry = loginFailures.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + 60_000;
  }
  loginFailures.set(email, entry);
}

export function clearLoginFailures(email: string): void {
  getDb().loginFailures.delete(email);
}
