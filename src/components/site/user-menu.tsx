"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicUser } from "@/lib/types";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";

export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const links: Array<{ href: string; label: string; icon: IconName }> = [
    { href: "/mypage", label: "マイページ", icon: "user" },
    { href: "/mypage?tab=prizes", label: "獲得景品", icon: "archive" },
    { href: "/mypage?tab=history", label: "履歴", icon: "history" },
    { href: "/earn", label: "チケットを貯める", icon: "ticket" },
    { href: "/guide", label: "デモガイド", icon: "book" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full bg-linear-to-br from-primary to-primary-2 text-sm font-black text-white ring-2 ring-surface-3 transition-transform hover:scale-105"
        aria-label="アカウントメニュー"
      >
        {user.nickname.slice(0, 1)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-60 animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold text-fg">{user.nickname}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="p-1.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <Icon name={link.icon} size={16} className="text-muted" />
                {link.label}
              </Link>
            ))}
            {user.role === "admin" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-accent hover:bg-surface-2"
              >
                <Icon name="shield" size={16} />
                管理画面
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2")}
            >
              <Icon name="logout" size={16} />
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
