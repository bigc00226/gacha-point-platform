import Link from "next/link";
import { cn } from "@/lib/format";

/** Capsule mark + wordmark. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3e8a" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <path d="M8 32a24 24 0 0 1 48 0z" fill="url(#logo-top)" />
      <path d="M8 32a24 24 0 0 0 48 0z" fill="#f1eeff" />
      <rect x="7" y="29.5" width="50" height="5" rx="2.5" fill="#0a0820" />
      <circle cx="32" cy="32" r="7.5" fill="#ffd23f" stroke="#0a0820" strokeWidth="3" />
      <circle cx="22" cy="20" r="3.2" fill="#fff" opacity=".75" />
    </svg>
  );
}

export function Logo({ siteName = "ポイガチャ", className }: { siteName?: string; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2", className)} aria-label={`${siteName} トップへ`}>
      <LogoMark size={30} className="transition-transform group-hover:rotate-12" />
      <span className="whitespace-nowrap font-display text-base leading-none tracking-wide text-fg min-[400px]:text-lg sm:text-xl">
        {siteName}
      </span>
      <span className="hidden rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-accent ring-1 ring-accent/40 sm:inline">
        DEMO
      </span>
    </Link>
  );
}
