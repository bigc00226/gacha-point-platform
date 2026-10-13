import "server-only";
import type { Currency, LedgerEntry, LedgerReason, User } from "@/lib/types";
import { ApiError } from "./http";
import { newId } from "./ids";
import type { Db } from "./store";

/**
 * The only way balances change. Each call updates the user's balance and appends
 * an immutable ledger row (付与履歴 / 消費履歴). Call inside the user's lock.
 */
function apply(
  db: Db,
  user: User,
  currency: Currency,
  amount: number,
  reason: LedgerReason,
  description: string,
  refId: string | null,
  at: string,
): LedgerEntry {
  if (!Number.isInteger(amount)) throw new Error(`ledger amount must be an integer: ${amount}`);
  const current = currency === "ticket" ? user.tickets : user.points;
  const next = current + amount;
  if (next < 0) {
    throw currency === "ticket"
      ? new ApiError(400, "INSUFFICIENT_TICKETS", "ガチャチケットが不足しています")
      : new ApiError(400, "INSUFFICIENT_POINTS", "ポイントが不足しています");
  }
  if (currency === "ticket") user.tickets = next;
  else user.points = next;
  const entry: LedgerEntry = {
    id: newId("lg"),
    userId: user.id,
    currency,
    amount,
    balanceAfter: next,
    reason,
    description,
    refId,
    createdAt: at,
  };
  db.ledger.push(entry);
  return entry;
}

export function changeTickets(
  db: Db,
  user: User,
  amount: number,
  reason: LedgerReason,
  description: string,
  refId: string | null = null,
  at: string = new Date().toISOString(),
): LedgerEntry {
  return apply(db, user, "ticket", amount, reason, description, refId, at);
}

export function changePoints(
  db: Db,
  user: User,
  amount: number,
  reason: LedgerReason,
  description: string,
  refId: string | null = null,
  at: string = new Date().toISOString(),
): LedgerEntry {
  return apply(db, user, "point", amount, reason, description, refId, at);
}
