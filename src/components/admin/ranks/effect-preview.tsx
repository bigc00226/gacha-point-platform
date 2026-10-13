"use client";

import { useState } from "react";
import type { RankEffect } from "@/lib/types";
import { EFFECT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EffectPlayer } from "@/components/gacha/effect-player";

export interface EffectPreviewTarget {
  name: string;
  color: string;
  logoUrl: string | null;
  effect: RankEffect;
}

/** Plays a rank's win effect on a dark stage (admin preview). */
export function EffectPreviewModal({ target, onClose }: { target: EffectPreviewTarget | null; onClose: () => void }) {
  const [run, setRun] = useState(0);
  const [ended, setEnded] = useState(false);

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target ? `演出プレビュー：${target.name}` : undefined}
      description={target ? `${EFFECT_TYPE_LABELS[target.effect.type]}${target.effect.url ? `（${target.effect.url.split("/").pop()}）` : ""}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          <Button
            leftIcon="refresh"
            onClick={() => {
              setEnded(false);
              setRun((n) => n + 1);
            }}
          >
            もう一度再生
          </Button>
        </>
      }
    >
      {target && (
        <div className="relative h-[min(60vh,440px)] overflow-hidden rounded-2xl bg-[#05030f]">
          <EffectPlayer
            key={run}
            effect={target.effect}
            rankName={target.name}
            rankColor={target.color}
            logoUrl={target.logoUrl}
            onEnd={() => setEnded(true)}
            className="absolute inset-0"
          />
          {ended && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
              再生が終了しました
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}
