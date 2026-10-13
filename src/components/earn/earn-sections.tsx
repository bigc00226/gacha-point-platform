import Link from "next/link";
import { LEDGER_REASON_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { formatRelative } from "@/lib/time";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { Countdown } from "@/components/gacha/countdown";
import type { EarnPageDto, RewardHistoryItemDto } from "./types";

/** Today's earnings + balance + reset countdown. */
export function EarnHero({ data }: { data: EarnPageDto }) {
  const viewer = data.viewer;
  const serverNow = Date.parse(data.serverNow);
  const items: Array<{ label: string; value: number; icon: IconName }> = viewer
    ? [
        { label: "ログイン", value: viewer.today.login, icon: "calendar" },
        { label: "動画", value: viewer.today.video, icon: "tv" },
        { label: "案件", value: viewer.today.offer, icon: "smartphone" },
      ]
    : [];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ticket/25 bg-linear-to-br from-[#10264a] via-surface to-[#2a1550] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-ticket/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-ticket/15 px-3 py-1 text-[11px] font-black tracking-widest text-ticket ring-1 ring-inset ring-ticket/35">
            <Icon name="ticket" size={12} />
            FREE TICKETS
          </p>
          <h1 className="mt-3 font-display text-2xl leading-tight text-fg sm:text-3xl">チケットを貯める</h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
            ログインボーナス・動画視聴・案件達成で、ガチャチケットを無料でゲット。チケットはすべてサーバー側で検証してから付与されます。
          </p>
        </div>
        {viewer ? (
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-80">
            <div className="col-span-2 rounded-2xl border border-line bg-bg/40 p-3">
              <p className="text-[11px] font-bold text-muted">今日獲得したチケット</p>
              <p className="tabular mt-0.5 font-display text-3xl leading-none text-ticket">
                +{formatNumber(viewer.today.total)}
                <span className="ml-1 text-base">枚</span>
              </p>
              <div className="mt-2 flex gap-3 text-[11px] text-muted">
                {items.map((it) => (
                  <span key={it.label} className="inline-flex items-center gap-1">
                    <Icon name={it.icon} size={12} />
                    {it.label} <span className="tabular font-bold text-fg">{formatNumber(it.value)}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-bg/40 p-3">
              <p className="text-[11px] font-bold text-muted">所持チケット</p>
              <p className="tabular mt-0.5 text-lg font-black text-ticket">
                {formatNumber(viewer.balances.tickets)}
                <span className="ml-0.5 text-xs">枚</span>
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-bg/40 p-3">
              <p className="text-[11px] font-bold text-muted">リセットまで</p>
              <p className="tabular mt-0.5 text-lg font-black text-fg">
                <Countdown endsAt={data.nextResetAt} serverNow={serverNow} prefix="" endedLabel="まもなく" />
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-bg/40 p-4 text-sm text-fg sm:w-80">
            <p className="font-bold">会員登録でチケット{formatNumber(data.settings.signupBonusTickets)}枚プレゼント</p>
            <p className="mt-1 text-xs text-muted">ログインすると、ボーナスの受け取りや動画視聴ができます。</p>
          </div>
        )}
      </div>
    </section>
  );
}

const SECURITY_STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "smartphone",
    title: "① 動画視聴・案件達成",
    body: "会員がリワード広告を最後まで視聴、またはオファーウォールの案件を達成します。",
  },
  {
    icon: "send",
    title: "② 配信会社が成果通知",
    body: "AdMob・skyflag・Tapjoyのサーバーから、当サイトのサーバーへ署名付きの成果通知（Webhook）が届きます。",
  },
  {
    icon: "shieldCheck",
    title: "③ サーバーで検証",
    body: "署名（HMAC）・時刻（±5分）・取引IDの重複・視聴セッション・1日の上限回数をすべて検証します。",
  },
  {
    icon: "ticket",
    title: "④ チケット付与と記録",
    body: "検証を通過した通知だけがチケットを付与し、付与履歴と成果通知ログに記録されます。",
  },
];

/** "How tickets are granted" — the anti-cheat design in plain words. */
export function SecurityExplainer() {
  return (
    <section aria-labelledby="security-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
          <Icon name="shieldCheck" size={20} />
        </span>
        <div>
          <h2 id="security-heading" className="text-base font-black text-fg sm:text-lg">
            チケット付与の仕組み（不正対策）
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
            ブラウザ（JavaScript）からはチケットを付与できない設計です。広告配信会社からの成果通知をサーバーで検証した場合にのみ付与されるため、画面の改ざんや通信の偽装ではチケットを増やせません。
          </p>
        </div>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {SECURITY_STEPS.map((s) => (
          <li key={s.title} className="relative rounded-2xl border border-line bg-surface-2 p-4">
            <span className="grid size-9 place-items-center rounded-xl bg-surface-3 text-primary">
              <Icon name={s.icon} size={18} />
            </span>
            <p className="mt-2.5 text-sm font-black text-fg">{s.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RecentRewards({ items, serverNow }: { items: RewardHistoryItemDto[]; serverNow: number }) {
  return (
    <section aria-labelledby="recent-heading" className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 id="recent-heading" className="text-base font-black text-fg">
          最近の獲得履歴
        </h2>
        <Link href="/mypage?tab=history" className="text-xs font-bold text-primary hover:underline">
          すべての履歴
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="history" title="まだ獲得履歴はありません" className="py-8" />
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ticket/12 text-ticket">
                <Icon name={item.reason === "video_reward" ? "tv" : item.reason === "offer_reward" ? "smartphone" : "calendar"} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{item.description}</p>
                <p className="text-[11px] text-subtle">
                  {LEDGER_REASON_LABELS[item.reason]} ・ {formatRelative(item.createdAt, serverNow)}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-black text-ticket">+{formatNumber(item.amount)}枚</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
