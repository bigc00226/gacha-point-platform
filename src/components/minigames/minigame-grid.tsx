"use client";

import { useEffect, useState } from "react";
import type { MiniGameSlot } from "@/lib/types";
import { cn, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";

const RATIO: Record<MiniGameSlot["aspectRatio"], string> = { "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1", "4:3": "4 / 3" };

/** Responsive iframe that keeps the slot's aspect ratio. */
export function MiniGameFrame({ game, className }: { game: Pick<MiniGameSlot, "title" | "embedUrl" | "aspectRatio">; className?: string }) {
  return (
    <div
      className={cn("relative mx-auto w-full overflow-hidden rounded-2xl border border-line bg-black", game.aspectRatio === "9:16" && "max-w-sm", className)}
      style={{ aspectRatio: RATIO[game.aspectRatio] }}
    >
      <iframe
        src={game.embedUrl}
        title={game.title}
        className="absolute inset-0 size-full"
        sandbox="allow-scripts allow-same-origin"
        allow="autoplay; fullscreen"
        loading="lazy"
      />
    </div>
  );
}

export function MiniGameGrid({ games }: { games: MiniGameSlot[] }) {
  const [playing, setPlaying] = useState<MiniGameSlot | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; score?: number } | null;
      if (data?.type === "poigacha:score" && typeof data.score === "number") setLastScore(data.score);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (games.length === 0) return <EmptyState icon="gamepad" title="公開中のミニゲームはありません" className="rounded-2xl border border-line bg-surface" />;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const ready = !!g.embedUrl;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  if (!ready) return;
                  setLastScore(null);
                  setPlaying(g);
                }}
                disabled={!ready}
                className={cn(
                  "group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition",
                  ready ? "hover:-translate-y-0.5 hover:border-line-strong" : "cursor-default opacity-80",
                )}
              >
                <div className="relative aspect-video bg-surface-2">
                  {g.thumbnailUrl && <img src={g.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />}
                  {ready ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
                      <span className="grid size-14 scale-90 place-items-center rounded-full bg-white/90 text-[#0a0820] opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100">
                        <Icon name="play" size={24} filled />
                      </span>
                    </span>
                  ) : (
                    <span className="absolute right-3 top-3">
                      <Badge tone="gold">近日公開</Badge>
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="text-base font-black text-fg">{g.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{g.description}</p>
                  <p className="mt-auto pt-2 text-[11px] text-subtle">提供: {g.provider || "—"}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title} size="xl" bodyClassName="px-3 pb-4 sm:px-5">
        {playing && (
          <div className="space-y-3">
            <MiniGameFrame game={playing} />
            <p className="text-center text-xs text-muted">
              {lastScore !== null ? (
                <>
                  ゲームから受け取ったスコア: <span className="font-black text-accent">{formatNumber(lastScore)}</span>（本番ではゲーム提供会社の成果通知でチケットを付与できます）
                </>
              ) : (
                "ゲームの結果は postMessage / 成果通知（Webhook）で受け取れる設計です。"
              )}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
