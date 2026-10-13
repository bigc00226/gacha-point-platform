"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { AdCreative, creativeIndexFor } from "./ad-creative";
import { Overlay } from "./overlay";
import type { AdCompleteDto, AdSessionStartDto } from "./types";
import { VerificationPanel } from "./verification-panel";

export type AdFlow =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "playing"; start: AdSessionStartDto }
  | { phase: "verifying"; start: AdSessionStartDto; complete: AdCompleteDto | null }
  | { phase: "error"; message: string; retry: "start" | "complete"; start: AdSessionStartDto | null };

const FAST_SPEED = 5;

/** The mock rewarded ad: cannot be finished early, pauses while the tab is hidden. */
function AdStage({
  start,
  fast,
  onFastChange,
  confirming,
  onRequestClose,
  onResume,
  onAbandon,
  onFinished,
}: {
  start: AdSessionStartDto;
  fast: boolean;
  onFastChange: (fast: boolean) => void;
  confirming: boolean;
  onRequestClose: () => void;
  onResume: () => void;
  onAbandon: () => void;
  onFinished: () => void;
}) {
  const total = start.ad.durationSec * 1000;
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const speedRef = useRef(fast ? FAST_SPEED : 1);
  const pausedRef = useRef(confirming);
  const finishedRef = useRef(onFinished);

  useEffect(() => {
    speedRef.current = fast ? FAST_SPEED : 1;
  }, [fast]);
  useEffect(() => {
    pausedRef.current = confirming;
  }, [confirming]);
  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - last);
      last = now;
      if (doneRef.current || pausedRef.current || document.hidden) return;
      elapsedRef.current = Math.min(total, elapsedRef.current + dt * speedRef.current);
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= total) {
        doneRef.current = true;
        window.clearInterval(id);
        window.setTimeout(() => finishedRef.current(), 650);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [total]);

  const done = elapsed >= total;
  const remainingSec = Math.max(0, Math.ceil((total - elapsed) / (fast ? FAST_SPEED : 1) / 1000));
  const progress = total > 0 ? elapsed / total : 1;

  return (
    <div className="absolute inset-0 select-none">
      <AdCreative index={creativeIndexFor(start.session.id)} progress={progress} />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-linear-to-b from-black/45 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="rounded-md border border-[#ffd23f]/80 bg-black/45 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-[#ffd23f]">
          広告
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold backdrop-blur",
              done ? "bg-success/90 text-white" : "bg-black/55 text-white",
            )}
            aria-live="polite"
          >
            <Icon name={done ? "checkCircle" : "gift"} size={14} />
            {done ? "報酬を獲得しました" : `報酬獲得まで ${remainingSec}秒`}
          </span>
          <button
            type="button"
            onClick={onRequestClose}
            className="grid size-8 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur transition-colors hover:bg-black/75"
            aria-label="広告を閉じる"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={fast}
            onClick={() => onFastChange(!fast)}
            className="inline-flex items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 text-[11px] font-bold text-white backdrop-blur"
          >
            <span className={cn("relative h-5 w-9 rounded-full transition-colors", fast ? "bg-accent" : "bg-white/25")}>
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                  fast && "translate-x-4",
                )}
              />
            </span>
            <span className="rounded bg-accent px-1 text-[9px] font-black text-[#2b1d00]">DEMO</span>
            早送り（×5）
          </button>
          <span className="text-[10px] text-white/55">デモ用の広告です</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-label="広告の再生状況"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-linear-to-r from-[#ffd23f] to-[#ff8a3d]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {confirming && (
        <div className="absolute inset-0 grid animate-fade-in place-items-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs animate-pop-in rounded-3xl border border-line bg-surface p-5 text-center shadow-2xl">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning/15 text-warning">
              <Icon name="alert" size={24} />
            </span>
            <p className="mt-3 text-base font-black text-fg">広告を閉じますか？</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              最後まで視聴しないと、チケットはもらえません。
              <br />
              あと<span className="font-bold text-fg">{remainingSec}秒</span>で
              <span className="font-bold text-ticket">{formatNumber(start.video.ticketsPerView)}枚</span>獲得できます。
            </p>
            <div className="mt-4 space-y-2">
              <Button fullWidth variant="primary" leftIcon="play" onClick={onResume}>
                視聴を続ける
              </Button>
              <Button fullWidth variant="ghost" onClick={onAbandon}>
                閉じる（報酬なし）
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyingSheet({
  flow,
  onClose,
  onWatchAnother,
}: {
  flow: Extract<AdFlow, { phase: "verifying" }>;
  onClose: () => void;
  onWatchAnother: () => void;
}) {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const complete = flow.complete;
  const revealed = complete !== null && revealedId === complete.result.postbackId;
  const remaining = complete?.video.remaining ?? 0;

  return (
    <div className="absolute inset-0 flex animate-fade-in flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.2em] text-ticket">REWARDED VIDEO</p>
          <p className="text-base font-black text-fg">報酬の確認</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="閉じる"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-xs leading-relaxed text-muted">
          広告の視聴が完了しました。チケットは画面の操作ではなく、
          <span className="font-bold text-fg">Google AdMob のサーバーから届く署名付きの視聴完了通知</span>
          をポイガチャのサーバーが検証したあとに付与されます。
        </p>
        <VerificationPanel
          kind="video"
          providerLabel="Google AdMob"
          result={complete?.result ?? null}
          balanceAfter={complete ? complete.balances.tickets : null}
          onRevealed={() => complete && setRevealedId(complete.result.postbackId)}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {revealed && complete?.result.granted && remaining > 0 && (
          <Button variant="gold" size="lg" fullWidth leftIcon="play" onClick={onWatchAnother}>
            続けて見る（本日あと{remaining}回）
          </Button>
        )}
        {revealed && remaining === 0 && (
          <p className="text-center text-xs text-muted">本日の視聴上限に達しました。0:00（日本時間）にリセットされます。</p>
        )}
        <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={!revealed}>
          {revealed ? "閉じる" : "サーバーで検証しています…"}
        </Button>
      </div>
    </div>
  );
}

/** Full-screen rewarded-ad experience driven by the card's AdFlow state. */
export function VideoAdOverlay({
  flow,
  fast,
  onFastChange,
  onFinished,
  onAbandon,
  onClose,
  onRetry,
  onWatchAnother,
}: {
  flow: AdFlow;
  fast: boolean;
  onFastChange: (fast: boolean) => void;
  onFinished: (start: AdSessionStartDto) => void;
  onAbandon: () => void;
  onClose: () => void;
  onRetry: () => void;
  onWatchAnother: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const playing = flow.phase === "playing";

  const requestClose = () => {
    if (playing) setConfirming(true);
    else onClose();
  };

  return (
    <Overlay
      open={flow.phase !== "idle"}
      label="リワード動画広告"
      onEscape={() => (playing && confirming ? setConfirming(false) : requestClose())}
      className="bg-black/85 backdrop-blur-sm"
    >
      <div className="flex h-full w-full items-center justify-center sm:p-6">
        <div className="relative h-full w-full overflow-hidden bg-[#05040f] sm:aspect-[9/16] sm:h-[min(860px,92dvh)] sm:w-auto sm:rounded-[28px] sm:shadow-2xl sm:ring-1 sm:ring-white/10">
          {flow.phase === "loading" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <Spinner size={30} className="mx-auto text-white/80" />
                <p className="mt-4 text-sm font-bold text-white">広告を読み込んでいます…</p>
                <p className="mt-1 text-xs text-white/55">サーバーが視聴セッションを発行しています</p>
              </div>
            </div>
          )}
          {flow.phase === "playing" && (
            <AdStage
              key={flow.start.session.id}
              start={flow.start}
              fast={fast}
              onFastChange={onFastChange}
              confirming={confirming}
              onRequestClose={() => setConfirming(true)}
              onResume={() => setConfirming(false)}
              onAbandon={() => {
                setConfirming(false);
                onAbandon();
              }}
              onFinished={() => onFinished(flow.start)}
            />
          )}
          {flow.phase === "verifying" && (
            <VerifyingSheet key={flow.start.session.id} flow={flow} onClose={onClose} onWatchAnother={onWatchAnother} />
          )}
          {flow.phase === "error" && (
            <div className="absolute inset-0 grid place-items-center bg-bg p-6 text-center">
              <div className="max-w-xs">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger/15 text-danger">
                  <Icon name="xCircle" size={24} />
                </span>
                <p className="mt-3 text-base font-black text-fg">
                  {flow.retry === "start" ? "広告を読み込めませんでした" : "報酬の確認ができませんでした"}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{flow.message}</p>
                <div className="mt-5 space-y-2">
                  <Button fullWidth leftIcon="refresh" onClick={onRetry}>
                    もう一度試す
                  </Button>
                  <Button fullWidth variant="ghost" onClick={onClose}>
                    閉じる
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
