"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";

export const SITE_NAV: Array<{ href: string; label: string; short: string; icon: IconName }> = [
  { href: "/", label: "ガチャ", short: "ガチャ", icon: "capsule" },
  { href: "/earn", label: "チケットを貯める", short: "貯める", icon: "ticket" },
  { href: "/exchange", label: "ポイント交換", short: "交換", icon: "gift" },
  { href: "/minigames", label: "ミニゲーム", short: "ゲーム", icon: "gamepad" },
];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/gacha");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop header navigation. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="メインメニュー">
      {SITE_NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors",
              active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon name={item.icon} size={16} className={active ? "text-primary" : undefined} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
