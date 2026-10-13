"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/** Plays a Lottie JSON (lottie-web, loaded on demand). */
export function LottiePreview({ url, loop = true, className }: { url: string; loop?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    (async () => {
      try {
        const [{ default: lottie }, res] = await Promise.all([import("lottie-web"), fetch(url)]);
        if (!res.ok) throw new Error(String(res.status));
        const animationData = await res.json();
        if (cancelled || !ref.current) return;
        const anim = lottie.loadAnimation({ container: ref.current, renderer: "svg", loop, autoplay: true, animationData });
        destroy = () => anim.destroy();
      } catch {
        if (!cancelled) setFailedUrl(url);
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, loop]);

  if (failedUrl === url) {
    return <div className={cn("grid place-items-center text-sm text-muted", className)}>Lottieを再生できませんでした</div>;
  }
  return <div ref={ref} className={cn("[&_svg]:!h-full [&_svg]:!w-full", className)} />;
}
