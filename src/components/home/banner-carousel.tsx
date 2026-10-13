"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";

export interface BannerItem {
  src: string;
  href: string;
  alt: string;
}

/** Swipeable hero banners (scroll-snap) that auto-advance and pause on hover/touch. */
export function BannerCarousel({ items, interval = 5500 }: { items: BannerItem[]; interval?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track || items.length === 0) return;
      const target = ((i % items.length) + items.length) % items.length;
      track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    },
    [items.length],
  );

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden) return;
      goTo(Math.round(track.scrollLeft / track.clientWidth) + 1);
    }, interval);
    return () => window.clearInterval(id);
  }, [paused, items.length, interval, goTo]);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (next !== index) setIndex(next);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="おすすめ情報"
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/40 sm:rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div ref={trackRef} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {items.map((item, i) => (
          <Link
            key={item.src}
            href={item.href}
            className="relative block aspect-[8/3] w-full shrink-0 snap-center"
            aria-label={`${item.alt}（${i + 1}/${items.length}）`}
          >
            <img
              src={item.src}
              alt={item.alt}
              className="size-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              draggable={false}
            />
          </Link>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/65 group-hover:opacity-100 sm:grid"
            aria-label="前のバナー"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/65 group-hover:opacity-100 sm:grid"
            aria-label="次のバナー"
          >
            <Icon name="chevronRight" size={22} />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5 sm:bottom-3">
            {items.map((item, i) => (
              <button
                key={item.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${i + 1}枚目のバナーを表示`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 sm:h-2",
                  i === index ? "w-6 bg-white sm:w-8" : "w-1.5 bg-white/45 hover:bg-white/70 sm:w-2",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
