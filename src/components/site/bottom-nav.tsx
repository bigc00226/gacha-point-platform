"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { isActivePath } from "./nav-links";

const ITEMS = [
  { href: "/", label: "ガチャ", icon: "capsule" },
  { href: "/earn", label: "貯める", icon: "ticket" },
  { href: "/exchange", label: "交換", icon: "gift" },
  { href: "/mypage", label: "マイページ", icon: "user" },
] as const;

/** Phone tab bar. */
export function BottomNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map((item) => {
          const href = item.href === "/mypage" && !loggedIn ? "/login" : item.href;
          const label = item.href === "/mypage" && !loggedIn ? "ログイン" : item.label;
          const active = isActivePath(pathname, href);
          return (
            <li key={item.href}>
              <Link
                href={href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors",
                  active ? "text-fg" : "text-subtle",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-linear-to-r from-primary/25 to-primary-2/25 text-primary",
                  )}
                >
                  <Icon name={item.href === "/mypage" && !loggedIn ? "login" : item.icon} size={20} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
