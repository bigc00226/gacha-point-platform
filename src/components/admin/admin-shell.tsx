"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/site/logo";
import { ADMIN_NAV } from "./admin-nav";

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({
  pathname,
  badges,
  onNavigate,
}: {
  pathname: string;
  badges: { pendingOrders: number };
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-5">
        <LogoMark size={28} />
        <div className="leading-tight">
          <p className="text-sm font-black text-fg">ポイガチャ</p>
          <p className="text-[10px] font-bold tracking-wider text-muted">管理画面 / ADMIN</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="管理メニュー">
        {ADMIN_NAV.map((section) => (
          <div key={section.group || "top"} className="mb-4">
            {section.group && (
              <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-subtle">{section.group}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary/10 font-bold text-primary" : "text-muted hover:bg-surface-3 hover:text-fg",
                      )}
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="tabular rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line p-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-fg">
          <Icon name="external" size={16} />
          ユーザー画面を表示
        </Link>
        <Link href="/guide" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-fg">
          <Icon name="book" size={16} />
          デモガイド
        </Link>
      </div>
    </div>
  );
}

export function AdminShell({
  adminName,
  badges,
  children,
}: {
  adminName: string;
  badges: { pendingOrders: number };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  async function logout() {
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <Sidebar pathname={pathname} badges={badges} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in border-r border-line bg-surface shadow-2xl">
            <Sidebar pathname={pathname} badges={badges} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-3 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="メニューを開く"
            >
              <Icon name="menu" size={20} />
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/12 px-2.5 py-1 text-[11px] font-bold text-warning ring-1 ring-inset ring-warning/30">
              <Icon name="flask" size={12} />
              デモ環境（データはメモリ上に保存）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">
              <Icon name="shield" size={14} className="mr-1 inline text-primary" />
              {adminName}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-3 hover:text-fg"
            >
              <Icon name="logout" size={16} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
