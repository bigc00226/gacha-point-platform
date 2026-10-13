"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * <img> for prize / gacha artwork with a graceful placeholder when the file is
 * missing (uploaded media can be deleted, sample files may still be generating).
 */
export function PrizeImage({
  src,
  alt,
  className,
  fallbackIcon = "gift",
  iconSize = 28,
  loading = "lazy",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: IconName;
  iconSize?: number;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <span className={cn("grid place-items-center text-white/35", className)} role="img" aria-label={alt}>
        <Icon name={fallbackIcon} size={iconSize} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={false}
      className={cn("object-contain", className)}
      onError={() => setFailed(src)}
    />
  );
}

/** Wide artwork (gacha thumbnails / banners) with a branded fallback panel. */
export function CoverImage({
  src,
  alt,
  className,
  loading = "lazy",
  fetchPriority,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <span
        className={cn(
          "grid place-items-center bg-linear-to-br from-[#2a1f6b] via-[#3b1858] to-[#5a1640] text-white/40",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <Icon name="capsule" size={40} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      draggable={false}
      className={cn("object-cover", className)}
      onError={() => setFailed(src)}
    />
  );
}
