"use client";

import { useEffect, useRef, useState } from "react";
import type { PostbackKind, VerificationStep } from "@/lib/types";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import styles from "./earn.module.css";

export interface PlannedStep {
  key: string;
  label: string;
}

/** The checks every notification goes through, in order. */
export const VERIFICATION_PLANS: Record<PostbackKind, PlannedStep[]> = {
  video: [
    { key: "signature", label: "署名検証（HMAC-SHA256）" },
    { key: "timestamp", label: "タイムスタンプ検証" },
    { key: "duplicate", label: "重複チェック（transaction_id）" },
    { key: "session", label: "広告セッション照合" },
    { key: "limit", label: "1日の視聴上限" },
    { key: "grant", label: "チケット付与" },
  ],
  offer: [
    { key: "signature", label: "署名検証（HMAC-SHA256）" },
    { key: "timestamp", label: "タイムスタンプ検証" },
    { key: "duplicate", label: "重複チェック（transaction_id）" },
    { key: "offer", label: "案件照合" },
    { key: "rate", label: "付与数の計算" },
    { key: "grant", label: "チケット付与" },
  ],
};

/** Plain-language purpose of each check (shown while it is pending). */
export const STEP_HINTS: Record<string, string> = {
  request: "通知の形式が正しいか",
  signature: "事業者の秘密鍵で署名された本物の通知か（改ざん・なりすまし対策）",
  timestamp: "5分以内に発行された新しい通知か（使い回し対策）",
  duplicate: "同じ取引IDで二重に付与していないか",
  session: "このサイトが発行した視聴セッションと一致するか",
  limit: "本日の視聴回数が上限を超えていないか",
  offer: "掲載中の案件で、まだ達成していないか",
  rate: "管理画面の設定（カテゴリ別の枚数×倍率）で付与数を決定",
  grant: "付与履歴（台帳）に記録してチケットを付与",
};

type RowState = "ok" | "ng" | "running" | "pending" | "skipped";

/**
 * Verification steps of a postback. With `animate`, the steps resolve one by one
 * (spinner → ✓ / ✕) and `onDone` fires after the last one.
 */
export function VerificationTimeline({
  steps,
  plan,
  animate = false,
  stepMs = 450,
  onDone,
  dense = false,
  className,
}: {
  steps: VerificationStep[];
  plan?: PlannedStep[];
  animate?: boolean;
  stepMs?: number;
  onDone?: () => void;
  dense?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(animate ? 0 : steps.length);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!animate) return;
    let shown = 0;
    const id = window.setInterval(() => {
      shown += 1;
      setRevealed(shown);
      if (shown >= steps.length) {
        window.clearInterval(id);
        doneRef.current?.();
      }
    }, stepMs);
    return () => window.clearInterval(id);
  }, [animate, steps.length, stepMs]);

  const finished = revealed >= steps.length;
  const failed = steps.some((s) => !s.ok);
  const rows: Array<{ key: string; label: string; detail: string; state: RowState }> = steps.map((step, i) => ({
    key: step.key,
    label: step.label,
    detail: step.detail,
    state: i < revealed ? (step.ok ? "ok" : "ng") : i === revealed ? "running" : "pending",
  }));
  for (const planned of plan ?? []) {
    if (steps.some((s) => s.key === planned.key)) continue;
    rows.push({
      key: planned.key,
      label: planned.label,
      detail: "",
      state: finished && failed ? "skipped" : "pending",
    });
  }

  return (
    <ol className={cn("relative", className)} aria-live="polite">
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        const done = row.state === "ok" || row.state === "ng";
        return (
          <li
            key={`${row.key}-${i}`}
            className={cn("relative flex gap-3", dense ? "pb-2.5" : "pb-3.5", last && "pb-0", done && animate && styles.stepIn)}
          >
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-0 left-[13px] w-0.5 rounded-full",
                  dense ? "top-7" : "top-8",
                  row.state === "ok" ? "bg-success/45" : row.state === "ng" ? "bg-danger/40" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-[1] mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors",
                row.state === "ok" && "bg-success/15 text-success ring-success/45",
                row.state === "ng" && "bg-danger/15 text-danger ring-danger/45",
                row.state === "running" && "bg-info/12 text-info ring-info/45",
                (row.state === "pending" || row.state === "skipped") && "bg-surface-2 text-subtle ring-line",
              )}
            >
              {row.state === "ok" && <Icon name="check" size={15} strokeWidth={3} />}
              {row.state === "ng" && <Icon name="x" size={15} strokeWidth={3} />}
              {row.state === "running" && <Spinner size={14} />}
              {row.state === "pending" && <span className="size-1.5 rounded-full bg-current" />}
              {row.state === "skipped" && <Icon name="minus" size={14} strokeWidth={2.5} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p
                  className={cn(
                    "text-sm font-bold leading-6",
                    row.state === "pending" || row.state === "skipped" ? "text-subtle" : "text-fg",
                  )}
                >
                  {row.label}
                </p>
                {row.state === "ok" && (
                  <span className="rounded bg-success/15 px-1.5 text-[10px] font-black leading-4 text-success">OK</span>
                )}
                {row.state === "ng" && (
                  <span className="rounded bg-danger/15 px-1.5 text-[10px] font-black leading-4 text-danger">NG</span>
                )}
              </div>
              <p
                className={cn(
                  "break-words text-xs leading-relaxed",
                  row.state === "ng" ? "text-danger" : row.state === "ok" ? "text-muted" : "text-subtle",
                )}
              >
                {done
                  ? row.detail
                  : row.state === "running"
                    ? "確認しています…"
                    : row.state === "skipped"
                      ? "前の検証で拒否されたため実行していません"
                      : (STEP_HINTS[row.key] ?? "")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
