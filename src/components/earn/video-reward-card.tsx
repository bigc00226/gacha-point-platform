"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatCountdown } from "@/lib/time";
import { cn, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { AdCompleteDto, AdSessionStartDto, VideoStatusDto } from "./types";
import { useNow } from "./use-now";
import { VideoAdOverlay, type AdFlow } from "./video-ad-player";
import styles from "./earn.module.css";

const FAST_FORWARD_KEY = "poigacha:ad-fast-forward";

function readFastForward(): boolean {
  try {
    return window.localStorage.getItem(FAST_FORWARD_KEY) === "1";
  } catch {
    return false;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ViewSlots({ used, limit }: { used: number; limit: number }) {
  if (limit > 10) {
    return (
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-linear-to-r from-ticket to-info" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: limit }, (_, i) => {
        const watched = i < used;
        return (
          <span
            key={i}
            className={cn(
              "grid h-7 flex-1 place-items-center rounded-lg ring-1 ring-inset transition-colors sm:h-8",
              watched ? "bg-ticket/18 text-ticket ring-ticket/45" : "bg-surface-2 text-subtle ring-line",
            )}
          >
            <Icon name={watched ? "check" : "play"} size={watched ? 14 : 11} strokeWidth={watched ? 3 : 2} filled={!watched} />
          </span>
        );
      })}
    </div>
  );
}

export function VideoRewardCard({
  video,
  ticketsPerView,
  dailyLimit,
  serverNow,
  className,
}: {
  /** null when signed out. */
  video: VideoStatusDto | null;
  ticketsPerView: number;
  dailyLimit: number;
  serverNow: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [flow, setFlow] = useState<AdFlow>({ phase: "idle" });
  const [fast, setFast] = useState(false);
  const runRef = useRef(0);
  const now = useNow(Date.parse(serverNow));

  const loggedIn = video !== null;
  const used = video?.todayCount ?? 0;
  const limit = video?.dailyLimit ?? dailyLimit;
  const remaining = video?.remaining ?? limit;
  const reward = video?.ticketsPerView ?? ticketsPerView;
  const limitReached = loggedIn && remaining <= 0;
  const resetIn = formatCountdown(video?.nextResetAt ?? serverNow, now);

  async function startAd() {
    const run = ++runRef.current;
    setFast(readFastForward());
    setFlow({ phase: "loading" });
    try {
      const start = await api.post<AdSessionStartDto>("/api/rewards/video/start");
      if (runRef.current === run) setFlow({ phase: "playing", start });
    } catch (err) {
      if (runRef.current !== run) return;
      if (err instanceof ApiClientError && err.code === "LIMIT_REACHED") {
        setFlow({ phase: "idle" });
        toast.warning("本日の動画視聴は上限に達しました", "毎日0:00（日本時間）にリセットされます。");
        router.refresh();
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        setFlow({ phase: "idle" });
        router.push("/login?next=/earn");
        return;
      }
      setFlow({ phase: "error", message: errorMessage(err), retry: "start", start: null });
    }
  }

  async function finishAd(start: AdSessionStartDto) {
    const run = runRef.current;
    setFlow({ phase: "verifying", start, complete: null });
    for (let attempt = 0; ; attempt++) {
      try {
        const complete = await api.post<AdCompleteDto>("/api/demo/ad-network/complete", { sessionId: start.session.id });
        if (runRef.current !== run) return;
        setFlow({ phase: "verifying", start, complete });
        router.refresh();
        return;
      } catch (err) {
        if (runRef.current !== run) return;
        // Network hiccup: ask again for the same session (the completion is idempotent per session).
        if (err instanceof ApiClientError && err.code === "NETWORK_ERROR" && attempt < 2) {
          await wait(700 * (attempt + 1));
          continue;
        }
        setFlow({ phase: "error", message: errorMessage(err), retry: "complete", start });
        return;
      }
    }
  }

  function close() {
    runRef.current++;
    setFlow({ phase: "idle" });
  }

  function abandon() {
    runRef.current++;
    setFlow({ phase: "idle" });
    toast.info("チケットは付与されませんでした", "動画を最後まで視聴すると獲得できます。");
  }

  function retry() {
    if (flow.phase !== "error") return;
    if (flow.retry === "complete" && flow.start) void finishAd(flow.start);
    else void startAd();
  }

  function changeFast(next: boolean) {
    setFast(next);
    try {
      window.localStorage.setItem(FAST_FORWARD_KEY, next ? "1" : "0");
    } catch {
      // Storage may be unavailable (private mode) — the toggle still works for this session.
    }
  }

  return (
    <section
      aria-labelledby="video-reward-title"
      className={cn("overflow-hidden rounded-3xl border border-line bg-surface", className)}
    >
      <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Preview */}
        <div className="relative isolate flex h-40 items-center justify-center overflow-hidden bg-linear-to-br from-[#5b2bd6] via-[#9d2bbd] to-[#ff3e8a] sm:h-48 md:h-auto md:min-h-64">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_45%)]" />
          <div className="absolute -left-6 bottom-3 opacity-60 blur-[0.5px]">
            <span className="block h-10 w-20 rotate-[-14deg] rounded-lg bg-white/15" />
          </div>
          <span className="absolute left-3 top-3 rounded-md border border-white/40 bg-black/25 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white">
            AD
          </span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs font-black text-white ring-1 ring-white/25">
            <Icon name="ticket" size={13} strokeWidth={2.4} />+{formatNumber(reward)}枚
          </span>
          <span className="absolute bottom-3 right-3 rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-bold tabular text-white">0:15</span>
          <div className="relative grid place-items-center">
            {!limitReached && <span className={cn("absolute size-20 rounded-full bg-white/35", styles.playRing)} />}
            <span
              className={cn(
                "relative grid size-20 place-items-center rounded-full shadow-2xl ring-4",
                limitReached ? "bg-white/30 text-white/70 ring-white/20" : "bg-white text-[#9d2bbd] ring-white/40",
              )}
            >
              <Icon name="play" size={34} filled className="translate-x-0.5" />
            </span>
          </div>
          {limitReached && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 text-center backdrop-blur-[1px]">
              <div>
                <p className="font-display text-lg text-white">本日分は終了</p>
                <p className="mt-1 text-xs text-white/75">0:00にリセット（あと{resetIn}）</p>
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="video-reward-title" className="font-display text-xl leading-tight text-fg">
                動画を見てチケットGET
              </h2>
              <Badge tone="info" size="xs" icon="shieldCheck">
                サーバー検証
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              15秒の動画を最後まで見ると、ガチャチケット
              <span className="mx-0.5 font-black text-ticket">{formatNumber(reward)}枚</span>
              がもらえます。
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-muted">本日の視聴</span>
              <span className="tabular font-bold text-fg">
                <span className="text-base text-ticket">{used}</span> / {limit}回
                {loggedIn && !limitReached && <span className="ml-1.5 text-muted">（あと{remaining}回）</span>}
              </span>
            </div>
            <ViewSlots used={used} limit={limit} />
          </div>

          <div className="mt-auto space-y-2.5">
            {!loggedIn ? (
              <ButtonLink href="/login?next=/earn" size="lg" fullWidth leftIcon="login">
                ログインして動画を見る
              </ButtonLink>
            ) : limitReached ? (
              <Button size="lg" fullWidth disabled leftIcon="ban" variant="secondary" className="h-auto min-h-12 whitespace-normal py-2.5 leading-snug">
                本日の上限に達しました（0:00にリセット）
              </Button>
            ) : (
              <Button size="lg" fullWidth leftIcon="play" onClick={startAd} loading={flow.phase === "loading"}>
                動画を見る（+{formatNumber(reward)}枚）
              </Button>
            )}
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle">
              <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-success" />
              <span>
                チケットは、広告ネットワーク（Google AdMob）から届く視聴完了通知をサーバーで検証してから付与されます。
                <a href="#anti-cheat" className="ml-1 font-bold text-ticket hover:underline">
                  仕組みを見る
                </a>
              </span>
            </p>
          </div>
        </div>
      </div>

      <VideoAdOverlay
        flow={flow}
        fast={fast}
        onFastChange={changeFast}
        onFinished={(start) => void finishAd(start)}
        onAbandon={abandon}
        onClose={close}
        onRetry={retry}
        onWatchAnother={() => void startAd()}
      />
    </section>
  );
}
