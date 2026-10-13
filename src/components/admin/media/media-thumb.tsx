"use client";

import type { CSSProperties } from "react";
import type { MediaKind } from "@/lib/types";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";

export const CHECKERBOARD: CSSProperties = {
  backgroundColor: "var(--surface)",
  backgroundImage:
    "conic-gradient(var(--surface-3) 25%, transparent 0 50%, var(--surface-3) 0 75%, transparent 0)",
  backgroundSize: "16px 16px",
};

/** Small preview of a media file by kind. */
export function MediaThumb({
  kind,
  url,
  name,
  className,
}: {
  kind: MediaKind;
  url: string;
  name: string;
  className?: string;
}) {
  if (kind === "image") {
    return (
      <div className={cn("overflow-hidden", className)} style={CHECKERBOARD}>
        <img src={url} alt={name} loading="lazy" className="size-full object-contain" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-[#0b0a1a]", className)}>
        <video src={`${url}#t=0.6`} muted playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-black/55 text-white">
            <Icon name="play" size={16} filled />
          </span>
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">MP4</span>
      </div>
    );
  }
  return (
    <div className={cn("grid place-items-center bg-linear-to-br from-[#2b1d6e] to-[#5c1e5a] text-white", className)}>
      <div className="flex flex-col items-center gap-1">
        <Icon name="sparkles" size={22} />
        <span className="rounded bg-white/15 px-1.5 text-[10px] font-black tracking-wider">LOTTIE</span>
      </div>
    </div>
  );
}
