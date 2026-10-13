/**
 * Date helpers. All user-facing dates are shown in Japan time (Asia/Tokyo) and
 * daily limits reset at AM 0:00 JST. Safe to use on both server and client.
 */
import type { JstDateKey } from "@/lib/types";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type DateInput = Date | number | string;

function toMs(input: DateInput): number {
  return input instanceof Date ? input.getTime() : new Date(input).getTime();
}

/** "YYYY-MM-DD" of the given instant in Japan time. */
export function jstDateKey(input: DateInput = Date.now()): JstDateKey {
  return new Date(toMs(input) + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Shift a JST date key by whole days. */
export function addDaysToKey(key: JstDateKey, days: number): JstDateKey {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The instant of the next AM 0:00 in Japan time. */
export function nextJstMidnight(input: DateInput = Date.now()): Date {
  const startOfTodayJst = Date.parse(`${jstDateKey(input)}T00:00:00.000Z`) - JST_OFFSET_MS;
  return new Date(startOfTodayJst + DAY_MS);
}

/** The instant of AM 0:00 (JST) of the day containing `input`. */
export function startOfJstDay(input: DateInput = Date.now()): Date {
  return new Date(Date.parse(`${jstDateKey(input)}T00:00:00.000Z`) - JST_OFFSET_MS);
}

const dateTimeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const monthDayFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

/** "2026/10/13 15:53" (JST) */
export function formatDateTime(input: DateInput): string {
  return dateTimeFmt.format(toMs(input));
}

/** "2026/10/13" (JST) */
export function formatDate(input: DateInput): string {
  return dateFmt.format(toMs(input));
}

/** "15:53" (JST) */
export function formatTime(input: DateInput): string {
  return timeFmt.format(toMs(input));
}

/** "10/13" (JST) */
export function formatMonthDay(input: DateInput): string {
  return monthDayFmt.format(toMs(input));
}

/** "たった今" / "5分前" / "3時間前" / "2日前" / "2026/10/01" */
export function formatRelative(input: DateInput, now: number = Date.now()): string {
  const diff = now - toMs(input);
  if (diff < 0) return formatDateTime(input);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return formatDate(input);
}

/** Remaining time until `target`, e.g. "3時間12分" / "12分". */
export function formatCountdown(target: DateInput, now: number = Date.now()): string {
  const diff = Math.max(0, toMs(target) - now);
  const totalMin = Math.ceil(diff / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}日${hours}時間`;
  if (hours > 0) return `${hours}時間${mins}分`;
  return `${mins}分`;
}

/** Current time in ms. Server components rendered per request read the clock through this. */
export function nowMs(): number {
  return Date.now();
}
