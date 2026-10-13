import type { GachaStatus } from "@/lib/types";
import { DRAW_COUNTS } from "@/lib/constants";

export type DrawBlockReason = "slots" | "tickets" | "unavailable";

export interface DrawOption {
  key: string;
  count: number;
  /** Tickets this option consumes. */
  cost: number;
  /** "10回引く" / "残り15口をすべて引く" */
  label: string;
  /** Compact label for the phone bar: "10回" / "残り15口" */
  short: string;
  /** "all" = draw every remaining slot (ラストワン賞 guaranteed). */
  kind: "count" | "all";
  disabled: boolean;
  reason: DrawBlockReason | null;
  reasonLabel: string | null;
  /** Visual emphasis (all-remaining / the very last slot). */
  highlight: boolean;
}

export interface DrawAvailability {
  ticketCost: number;
  remaining: number;
  status: GachaStatus;
  ended: boolean;
  /** null when signed out (buttons lead to the login page). */
  tickets: number | null;
}

export function isOnSale(a: Pick<DrawAvailability, "status" | "ended" | "remaining">): boolean {
  return a.status === "active" && !a.ended && a.remaining > 0;
}

export function unavailableLabel(a: Pick<DrawAvailability, "status" | "ended" | "remaining">): string {
  if (a.status === "soldout" || a.remaining <= 0) return "完売しました";
  if (a.ended) return "販売期間が終了しました";
  if (a.status === "paused") return "一時停止中です";
  if (a.status === "draft") return "公開前です";
  return "現在ご利用いただけません";
}

function option(count: number, kind: DrawOption["kind"], a: DrawAvailability): DrawOption {
  const cost = count * a.ticketCost;
  let reason: DrawBlockReason | null = null;
  if (!isOnSale(a)) reason = "unavailable";
  else if (count > a.remaining) reason = "slots";
  else if (a.tickets !== null && a.tickets < cost) reason = "tickets";
  const lastSlot = kind === "count" && count === 1 && a.remaining === 1 && reason === null;
  return {
    key: kind === "all" ? "all" : String(count),
    count,
    cost,
    label: kind === "all" ? `残り${count.toLocaleString("ja-JP")}口をすべて引く` : lastSlot ? "ラストワンを引く" : `${count}回引く`,
    short: kind === "all" ? `残り${count}口` : `${count}回`,
    kind,
    disabled: reason !== null,
    reason,
    reasonLabel: reason === "slots" ? "残り口数不足" : reason === "tickets" ? "チケット不足" : reason === "unavailable" ? "販売していません" : null,
    highlight: kind === "all" || lastSlot,
  };
}

/** 「1回」「10回」「100回」, plus 「残りN口をすべて引く」 when 1 < remaining < 100. */
export function computeDrawOptions(a: DrawAvailability): DrawOption[] {
  const options = DRAW_COUNTS.map((count) => option(count, "count", a));
  if (isOnSale(a) && a.remaining > 1 && a.remaining < 100) options.push(option(a.remaining, "all", a));
  return options;
}
