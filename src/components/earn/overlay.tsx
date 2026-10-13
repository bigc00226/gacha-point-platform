"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/format";
import { getPortalRoot, useIsClient } from "@/components/ui/use-is-client";

/**
 * Full-screen layer rendered into the themed #app-portal (above the header and the
 * phone tab bar). Locks body scroll, focuses itself and reports Escape.
 */
export function Overlay({
  open,
  label,
  onEscape,
  className,
  children,
}: {
  open: boolean;
  label: string;
  onEscape?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open || !isClient) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escapeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open, isClient]);

  if (!open || !isClient) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={cn("fixed inset-0 z-[80] outline-none", className)}
    >
      {children}
    </div>,
    getPortalRoot(),
  );
}
