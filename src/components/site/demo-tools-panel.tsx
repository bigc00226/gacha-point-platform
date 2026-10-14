"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicUser } from "@/lib/types";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

type Action = "login-user" | "login-admin" | "tickets" | "points" | "video" | "lastone" | "reset";

/**
 * Floating "DEMO" tab (right edge) with shortcuts for evaluating the demo.
 * All endpoints behind it are disabled with DEMO_TOOLS_ENABLED=false.
 */
export function DemoToolsPanel({ user }: { user: PublicUser | null }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest("[data-demo-tab]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  async function run(action: Action) {
    setBusy(action);
    try {
      switch (action) {
        case "login-user":
        case "login-admin": {
          const account = action === "login-admin" ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.user;
          await api.post("/api/auth/login", { email: account.email, password: account.password });
          toast.success(`${account.label}でログインしました`);
          if (action === "login-admin") router.push("/admin");
          break;
        }
        case "tickets":
          await api.post("/api/demo/grant", { tickets: 1000 });
          toast.success("ガチャチケットを1,000枚追加しました");
          break;
        case "points":
          await api.post("/api/demo/grant", { points: 100_000 });
          toast.success("100,000ptを追加しました");
          break;
        case "video":
          await api.post("/api/demo/video-reset");
          toast.success("本日の動画視聴回数をリセットしました");
          break;
        case "lastone":
          await api.post("/api/demo/last-one-setup", { gachaId: "g_goldrush", remaining: 5 });
          toast.success("ゴールドラッシュガチャを残り5口にしました", "最後の1口を引くとラストワン賞です");
          setOpen(false);
          router.push("/gacha/g_goldrush");
          break;
        case "reset":
          await api.post("/api/demo/reset");
          toast.success("デモデータを初期化しました");
          setConfirmReset(false);
          break;
      }
      router.refresh();
    } catch (err) {
      toast.error("操作できませんでした", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const item = (action: Action, icon: IconName, label: string, sub?: string) => (
    <button
      type="button"
      onClick={() => (action === "reset" ? setConfirmReset(true) : run(action))}
      disabled={busy !== null}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", action === "reset" ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent")}>
        {busy === action ? <Spinner size={16} /> : <Icon name={icon} size={17} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-fg">{label}</span>
        {sub && <span className="block text-[11px] text-muted">{sub}</span>}
      </span>
    </button>
  );

  return (
    <>
      <button
        type="button"
        data-demo-tab
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="デモ操作パネルを開く"
        className={cn(
          // Phones: slim enough to sit inside the 16px page gutter instead of covering text.
          "fixed right-0 top-[58%] z-[60] flex -translate-y-1/2 items-center gap-1 rounded-l-lg border border-r-0 border-accent/50 bg-[#1d1405]/95 px-[3px] py-2 text-[9px] font-black tracking-[0.18em] text-accent shadow-xl backdrop-blur transition-transform hover:-translate-x-0.5 sm:rounded-l-xl sm:px-1.5 sm:py-3 sm:text-[11px] sm:tracking-[0.2em]",
          "[writing-mode:vertical-rl]",
        )}
      >
        <Icon name="flask" size={14} className="hidden rotate-90 sm:block" />
        DEMO
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="デモ操作パネル"
          className="fixed right-10 top-1/2 z-[60] w-[min(21rem,calc(100vw-3.5rem))] -translate-y-1/2 animate-fade-in overflow-hidden rounded-2xl border border-accent/30 bg-surface shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line bg-accent/8 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-black text-accent">
              <Icon name="flask" size={16} />
              デモ操作パネル
            </p>
            <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="閉じる">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="max-h-[70dvh] overflow-y-auto p-2">
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-subtle">アカウント</p>
            {user ? (
              <div className="mx-1 mb-1 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                <span className="font-bold text-fg">{user.nickname}</span>
                <span className="ml-1 text-xs text-muted">（{user.role === "admin" ? "管理者" : "一般会員"}）でログイン中</span>
              </div>
            ) : (
              <p className="px-3 pb-1 text-xs text-muted">ログインしていません</p>
            )}
            {(!user || user.role === "admin") && item("login-user", "user", "一般会員でログイン", DEMO_ACCOUNTS.user.email)}
            {(!user || user.role !== "admin") && item("login-admin", "shield", "管理者でログイン", `${DEMO_ACCOUNTS.admin.email} → 管理画面へ`)}

            {user && (
              <>
                <p className="px-3 pb-1 pt-3 text-[11px] font-bold text-subtle">すぐに試す</p>
                {item("tickets", "ticket", "ガチャチケット +1,000枚", "100回引きを何度も試せます")}
                {item("points", "coin", "ポイント +100,000pt", "高額景品の交換を試せます")}
                {item("video", "tv", "動画の視聴回数をリセット", "1日の上限（0:00リセット）を再体験")}
                {item("lastone", "crown", "ラストワン直前にする", "ゴールドラッシュガチャを残り5口に")}
              </>
            )}
            <p className="px-3 pb-1 pt-3 text-[11px] font-bold text-subtle">デモ環境</p>
            {item("reset", "refresh", "デモデータを初期化", "すべてのデータを初期状態に戻す")}
            <div className="mt-2 grid grid-cols-3 gap-1.5 px-1 pb-2">
              {[
                ["/guide", "book", "ガイド"],
                ["/admin", "gauge", "管理画面"],
                ["/mypage", "user", "マイページ"],
              ].map(([href, icon, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line py-2 text-[11px] font-bold text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  <Icon name={icon as IconName} size={16} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => run("reset")}
        loading={busy === "reset"}
        tone="danger"
        title="デモデータを初期化しますか？"
        description="会員・ガチャ・履歴などすべてのデータが初期状態に戻ります。デモアカウントのログイン状態は維持されます。"
        confirmLabel="初期化する"
      />
    </>
  );
}
