"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MypageDto } from "@/lib/server/services/mypage";
import { api } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/time";
import { ButtonLink, Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { DescriptionList } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { CouponRedeem } from "./coupon-redeem";
import { DrawHistory, LedgerList, OrdersList } from "./history-lists";
import { PrizeBox } from "./prize-box";
import type { MypageTab } from "./tabs";


function BalanceCard({ kind, value, actions }: { kind: "ticket" | "point"; value: number; actions: Array<{ href: string; label: string; icon: IconName; primary?: boolean }> }) {
  const ticket = kind === "ticket";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5",
        ticket ? "border-ticket/30 bg-linear-to-br from-ticket/15 via-surface to-surface" : "border-point/30 bg-linear-to-br from-point/15 via-surface to-surface",
      )}
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-8 size-32 rounded-full blur-2xl", ticket ? "bg-ticket/20" : "bg-point/20")} aria-hidden="true" />
      <div className="relative">
        <p className={cn("flex items-center gap-1.5 text-sm font-black", ticket ? "text-ticket" : "text-point")}>
          <Icon name={ticket ? "ticket" : "coin"} size={18} strokeWidth={2.3} />
          {ticket ? "ガチャチケット" : "ポイント"}
        </p>
        <p className={cn("tabular mt-2 font-display text-4xl leading-none", ticket ? "text-ticket" : "text-point")}>
          {formatNumber(value)}
          <span className="ml-1 text-lg">{ticket ? "枚" : "pt"}</span>
        </p>
        <p className="mt-2 text-xs text-muted">{ticket ? "ガチャを引くときに使います（動画視聴・案件・ログインで獲得）" : "景品と交換できます（ガチャの当選・クーポンで獲得）"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <ButtonLink key={a.href} href={a.href} size="sm" variant={a.primary ? (ticket ? "primary" : "gold") : "secondary"} leftIcon={a.icon}>
              {a.label}
            </ButtonLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MypageView({ data, initialTab }: { data: MypageDto; initialTab: MypageTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<MypageTab>(initialTab);
  const [loggingOut, setLoggingOut] = useState(false);

  function changeTab(next: MypageTab) {
    setTab(next);
    const url = next === "overview" ? "/mypage" : `/mypage?tab=${next}`;
    window.history.replaceState(null, "", url);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const { user, stats } = data;
  const tabs = [
    { key: "overview" as const, label: "概要", icon: "user" as const },
    { key: "prizes" as const, label: "獲得景品", icon: "gift" as const, count: stats.prizesToShip || undefined },
    { key: "orders" as const, label: "交換・発送状況", icon: "truck" as const, count: stats.pendingOrders || undefined },
    { key: "history" as const, label: "履歴", icon: "history" as const },
    { key: "draws" as const, label: "ガチャ履歴", icon: "capsule" as const },
    { key: "account" as const, label: "アカウント", icon: "sliders" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary to-primary-2 text-2xl font-black text-white shadow-lg shadow-primary/30">
          {user.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted">マイページ</p>
          <h1 className="truncate font-display text-xl text-fg sm:text-2xl">{user.nickname}さん</h1>
          <p className="text-[11px] text-subtle">
            {formatDate(user.createdAt)} から会員 ・ ガチャ {formatNumber(stats.draws)}回（{formatNumber(stats.slots)}口）
          </p>
        </div>
      </div>

      <Tabs items={tabs} value={tab} onChange={changeTab} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <BalanceCard
              kind="ticket"
              value={user.tickets}
              actions={[
                { href: "/", label: "ガチャを引く", icon: "capsule", primary: true },
                { href: "/earn", label: "チケットを貯める", icon: "ticket" },
              ]}
            />
            <BalanceCard kind="point" value={user.points} actions={[{ href: "/exchange", label: "ポイント交換", icon: "gift", primary: true }]} />
          </div>

          <CouponRedeem />

          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/earn#login-bonus" className="rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Icon name="calendar" size={14} /> ログインボーナス
              </p>
              <p className={cn("mt-1.5 text-sm font-black", data.loginBonus.claimedToday ? "text-success" : "text-warning")}>
                {data.loginBonus.claimedToday ? `受け取り済み（${data.loginBonus.streak}日連続）` : `未受け取り（+${data.loginBonus.tickets}枚）`}
              </p>
            </Link>
            <Link href="/earn#video" className="rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Icon name="tv" size={14} /> 本日の動画視聴
              </p>
              <p className="tabular mt-1.5 text-sm font-black text-fg">
                {data.video.todayCount} / {data.video.dailyLimit}回
                <span className="ml-1 text-xs font-bold text-muted">（あと{data.video.remaining}回）</span>
              </p>
            </Link>
            <button type="button" onClick={() => changeTab("prizes")} className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Icon name="gift" size={14} /> 獲得景品
              </p>
              <p className={cn("mt-1.5 text-sm font-black", stats.prizesToShip > 0 ? "text-warning" : "text-fg")}>
                {stats.prizesToShip > 0 ? `発送手続きが必要: ${stats.prizesToShip}件` : `${formatNumber(data.prizes.length)}件`}
              </p>
            </button>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-fg">最近の履歴</h2>
              <button type="button" onClick={() => changeTab("history")} className="text-xs font-bold text-primary hover:underline">
                すべて見る
              </button>
            </div>
            <LedgerList entries={data.ledger.slice(0, 5)} />
          </section>
        </div>
      )}

      {tab === "prizes" && <PrizeBox prizes={data.prizes} lastAddress={data.lastAddress} />}
      {tab === "orders" && <OrdersList orders={data.orders} />}
      {tab === "history" && <LedgerList entries={data.ledger} />}
      {tab === "draws" && <DrawHistory draws={data.draws} />}
      {tab === "account" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <DescriptionList
              items={[
                { label: "ニックネーム", value: user.nickname },
                { label: "メールアドレス", value: user.email },
                { label: "会員ID", value: <span className="font-mono text-xs">{user.id}</span> },
                { label: "登録日時", value: formatDateTime(user.createdAt) },
                {
                  label: "お届け先",
                  value: data.lastAddress ? `${data.lastAddress.prefecture}${data.lastAddress.city}…（${data.lastAddress.fullName} 様）` : "未登録",
                },
              ]}
            />
          </div>
          <p className="text-xs text-muted">※デモ版のため、メールアドレス・パスワードの変更機能は省略しています。</p>
          <Button variant="secondary" leftIcon="logout" onClick={logout} loading={loggingOut}>
            ログアウト
          </Button>
        </div>
      )}
    </div>
  );
}
