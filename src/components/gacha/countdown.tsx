"use client";

import { formatCountdown } from "@/lib/time";
import { useNow } from "./client-utils";

/**
 * "終了まで 3日4時間" — rendered with the server's clock first (no hydration
 * mismatch), then ticking with the browser clock.
 */
export function Countdown({
  endsAt,
  serverNow,
  prefix = "あと",
  endedLabel = "終了しました",
}: {
  endsAt: string;
  serverNow: number;
  prefix?: string;
  endedLabel?: string;
}) {
  const now = useNow(serverNow);
  if (Date.parse(endsAt) <= now) return <>{endedLabel}</>;
  return (
    <>
      {prefix}
      {formatCountdown(endsAt, now)}
    </>
  );
}
