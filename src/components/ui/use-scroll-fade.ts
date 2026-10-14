"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Fades the edge(s) of a horizontally scrollable row that still have content
 * behind them, so a cut-off chip or tab reads as "scroll for more" on phones.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>, enabled = true, size = 28): CSSProperties | undefined {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const update = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    // Fires once on observe, then on every resize.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [ref, enabled]);

  if (!enabled || (!edges.start && !edges.end)) return undefined;
  const gradient = `linear-gradient(to right, ${edges.start ? "transparent" : "#000"} 0, #000 ${edges.start ? size : 0}px, #000 calc(100% - ${edges.end ? size : 0}px), ${edges.end ? "transparent" : "#000"} 100%)`;
  return { maskImage: gradient, WebkitMaskImage: gradient };
}
