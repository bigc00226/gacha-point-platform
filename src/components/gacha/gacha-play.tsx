"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import type { DrawResponse, RemainingInfo } from "@/lib/api-types";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Amount } from "@/components/ui/currency";
import { Checkbox } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { newRequestId, readSkipConfirm, useAnimatedNumber, writeSkipConfirm } from "./client-utils";
import { computeDrawOptions, isOnSale, unavailableLabel, type DrawOption } from "./draw-options";
import { DrawOverlay, type DrawSession } from "./draw-overlay";
import { unlockAudio } from "./sfx";
import type { GachaDetailDto, GachaViewerDto } from "./types";

const NETWORK_DRAW_MESSAGE = "通信エラーが発生しました。結果はマイページのガチャ履歴で確認できます";
const MAX_RETRIES = 2;

interface GachaPlayValue {
  gacha: GachaDetailDto;
  viewer: GachaViewerDto | null;
  remaining: RemainingInfo;
  tickets: number | null;
  options: DrawOption[];
  onSale: boolean;
  busy: boolean;
  loginHref: string;
  requestDraw: (option: DrawOption) => void;
}

const GachaPlayContext = createContext<GachaPlayValue | null>(null);

function useGachaPlay(): GachaPlayValue {
  const value = use(GachaPlayContext);
  if (!value) throw new Error("useGachaPlay must be used inside <GachaPlayProvider>");
  return value;
}

function isRetryable(err: unknown): boolean {
  return err instanceof ApiClientError && (err.code === "NETWORK_ERROR" || err.code === "BAD_RESPONSE");
}

/**
 * POST the draw. On a network failure retry up to 2× with the SAME requestId —
 * if the first request actually reached the server, the retry is answered with
 * the stored result (`replayed: true`) and no extra tickets are consumed.
 */
async function postDraw(gachaId: string, count: number, requestId: string): Promise<DrawResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api.post<DrawResponse>(`/api/gachas/${encodeURIComponent(gachaId)}/draw`, { count, requestId });
    } catch (err) {
      if (!isRetryable(err) || attempt >= MAX_RETRIES) throw err;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
}

const newer = (a: RemainingInfo | null, b: RemainingInfo): RemainingInfo =>
  a && Date.parse(a.fetchedAt) >= Date.parse(b.fetchedAt) ? a : b;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GachaPlayProvider({
  gacha,
  viewer,
  initialRemaining,
  children,
}: {
  gacha: GachaDetailDto;
  viewer: GachaViewerDto | null;
  /** Rendered by the server together with the page (its fetchedAt = render time). */
  initialRemaining: RemainingInfo;
  children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [remote, setRemote] = useState<RemainingInfo | null>(null);
  const [localTickets, setLocalTickets] = useState<{ tickets: number; at: string } | null>(null);
  const [session, setSession] = useState<DrawSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<DrawOption | null>(null);
  const [dontAsk, setDontAsk] = useState(false);
  const busyRef = useRef(false);
  const keyRef = useRef(0);

  // Latest known values: server render vs. the API responses (whichever is newer).
  const remaining = newer(remote, initialRemaining);
  const tickets = viewer
    ? localTickets && Date.parse(localTickets.at) > Date.parse(initialRemaining.fetchedAt)
      ? localTickets.tickets
      : viewer.tickets
    : null;
  const loginHref = `/login?next=${encodeURIComponent(`/gacha/${gacha.id}`)}`;
  const availability = {
    ticketCost: gacha.ticketCost,
    remaining: remaining.remainingSlots,
    status: remaining.status,
    ended: gacha.ended,
    tickets,
  };
  const options = computeDrawOptions(availability);
  const onSale = isOnSale(availability);

  // Page load: fetch the latest remaining count once (no polling / WebSocket).
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .get<RemainingInfo>(`/api/gachas/${encodeURIComponent(gacha.id)}/remaining`, ctrl.signal)
      .then(setRemote)
      .catch(() => {});
    return () => ctrl.abort();
  }, [gacha.id]);

  const refreshRemaining = () => {
    api
      .get<RemainingInfo>(`/api/gachas/${encodeURIComponent(gacha.id)}/remaining`)
      .then(setRemote)
      .catch(() => {});
  };

  const handleError = (err: unknown) => {
    const code = err instanceof ApiClientError ? err.code : "";
    const status = err instanceof ApiClientError ? err.status : 0;
    if (status === 401) {
      toast.warning("ログインが必要です", "ログインしてから、もう一度お試しください。");
      router.push(loginHref);
      return;
    }
    if (code === "INSUFFICIENT_TICKETS") {
      toast.error("ガチャチケットが不足しています", errorMessage(err));
      router.refresh();
      return;
    }
    if (["INSUFFICIENT_SLOTS", "SOLD_OUT", "GACHA_ENDED", "GACHA_UNAVAILABLE"].includes(code)) {
      toast.warning("ガチャを引けませんでした", errorMessage(err));
      refreshRemaining();
      router.refresh();
      return;
    }
    toast.error("ガチャを引けませんでした", errorMessage(err));
  };

  const run = async (count: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const key = ++keyRef.current;
    setSession({ key, count, status: "pending", response: null, error: null });
    try {
      const res = await postDraw(gacha.id, count, newRequestId());
      setRemote(res.remaining);
      setLocalTickets({ tickets: res.balances.tickets, at: res.remaining.fetchedAt });
      setSession((s) => (s && s.key === key ? { ...s, status: "done", response: res } : s));
    } catch (err) {
      if (isRetryable(err)) {
        setSession((s) => (s && s.key === key ? { ...s, status: "error", error: NETWORK_DRAW_MESSAGE } : s));
      } else {
        setSession((s) => (s && s.key === key ? null : s));
        handleError(err);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const requestDraw = (option: DrawOption) => {
    if (!viewer) {
      router.push(loginHref);
      return;
    }
    if (option.disabled || busyRef.current) return;
    unlockAudio();
    if (option.count > 1 && !readSkipConfirm()) {
      setDontAsk(false);
      setConfirm(option);
      return;
    }
    void run(option.count);
  };

  const confirmDraw = () => {
    if (!confirm) return;
    if (dontAsk) writeSkipConfirm(true);
    unlockAudio();
    const count = confirm.count;
    setConfirm(null);
    void run(count);
  };

  const close = () => {
    setSession(null);
    router.refresh();
  };

  const value: GachaPlayValue = { gacha, viewer, remaining, tickets, options, onSale, busy, loginHref, requestDraw };

  return (
    <GachaPlayContext value={value}>
      {children}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={confirmDraw}
        title={confirm ? (confirm.kind === "all" ? confirm.label : `${confirm.count}回引きますか？`) : ""}
        description={confirm?.kind === "all" && gacha.lastOnePrize ? "最後の1口まで引くので、ラストワン賞が確定します。" : undefined}
        confirmLabel={confirm ? `${formatNumber(confirm.count)}回引く` : "引く"}
        tone={confirm && (confirm.kind === "all" || confirm.count >= 100) ? "gold" : "primary"}
      >
        {confirm && tickets !== null && (
          <div className="space-y-4">
            <dl className="divide-y divide-line rounded-2xl border border-line bg-surface-2 text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted">ガチャ</dt>
                <dd className="truncate font-bold text-fg">{gacha.title}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted">使用するチケット</dt>
                <dd>
                  <Amount kind="ticket" value={confirm.cost} size="md" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted">所持チケット</dt>
                <dd className="flex items-center gap-1.5">
                  <Amount kind="ticket" value={tickets} size="sm" className="opacity-70" />
                  <Icon name="arrowRight" size={14} className="text-subtle" />
                  <Amount kind="ticket" value={tickets - confirm.cost} size="md" />
                </dd>
              </div>
            </dl>
            <Checkbox label="次回から確認しない" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
          </div>
        )}
      </ConfirmDialog>
      {session && (
        <DrawOverlay session={session} gacha={gacha} againOptions={options} onDrawAgain={(count) => void run(count)} onClose={close} />
      )}
    </GachaPlayContext>
  );
}

// ---------------------------------------------------------------------------
// Remaining counter
// ---------------------------------------------------------------------------

export function RemainingCounter({ className }: { className?: string }) {
  const { gacha, remaining } = useGachaPlay();
  const value = useAnimatedNumber(remaining.remainingSlots);
  const total = remaining.totalSlots;
  const soldOut = remaining.status === "soldout" || remaining.remainingSlots <= 0;
  const near = !soldOut && (remaining.remainingSlots <= 100 || remaining.remainingSlots <= total * 0.01);
  const sold = Math.max(0, total - remaining.remainingSlots);

  return (
    <section
      aria-label="残り口数"
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
        near ? "border-accent/45 bg-linear-to-br from-accent/14 via-surface to-surface" : "border-line bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Icon name="layers" size={14} />
          残り口数
        </p>
        {soldOut ? (
          <Badge tone="danger" icon="ban">
            完売
          </Badge>
        ) : near ? (
          <Badge tone="gold" icon="flame">
            ラストワン間近
          </Badge>
        ) : (
          <span className="tabular text-[11px] font-bold text-subtle">販売済 {formatNumber(sold)}口</span>
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5" aria-live="polite">
        <span className="text-sm font-bold text-muted">残り</span>
        <span className={cn("tabular font-display text-[2rem] leading-tight", near ? "text-gradient-gold" : "text-fg")}>
          {formatNumber(value)}
        </span>
        <span className="text-sm font-bold text-fg">口</span>
        <span className="tabular text-sm font-medium text-muted">/ {formatNumber(total)}口</span>
      </p>
      <ProgressBar value={remaining.remainingSlots} max={total} tone={near || soldOut ? "gold" : "rainbow"} size="md" className="mt-2.5" label="残り口数の割合" />
      {near && gacha.lastOnePrize && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs font-bold leading-relaxed text-accent">
          <Icon name="crown" size={14} filled className="mt-0.5 shrink-0" />
          あと{formatNumber(remaining.remainingSlots)}口で、ラストワン賞「{gacha.lastOnePrize.name}」の当選者が決まります！
        </p>
      )}
      {soldOut && remaining.lastOneWinner && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs font-bold leading-relaxed text-accent">
          <Icon name="crown" size={14} filled className="mt-0.5 shrink-0" />
          ラストワン賞は{remaining.lastOneWinner.nickname}さんが獲得しました
        </p>
      )}
      <p className="mt-2.5 flex items-start gap-1 text-[11px] leading-relaxed text-subtle">
        <Icon name="info" size={12} className="mt-0.5 shrink-0" />
        <span>
          残り口数はページ表示時・ガチャ実行時に更新されます（{formatTime(remaining.fetchedAt)} 時点）
        </span>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Draw panel (desktop: buttons inline; phones: info only — buttons live in the sticky bar)
// ---------------------------------------------------------------------------

function DrawButton({ option, busy, onClick, size = "lg" }: { option: DrawOption; busy: boolean; onClick: () => void; size?: "lg" | "md" }) {
  const variant = option.highlight ? "gold" : option.count >= 100 ? "gold" : option.count >= 10 ? "primary" : "secondary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={option.disabled || busy}
      className={cn(
        buttonClasses(variant, size === "lg" ? "xl" : "lg", true),
        "justify-between px-5 text-left",
        option.highlight && !option.disabled && "animate-pulse-glow text-[#3a2100]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name={option.kind === "all" ? "crown" : "capsule"} size={20} filled={option.kind === "all"} />
        <span className={cn("truncate", option.kind === "all" && "text-[15px]")}>{option.label}</span>
      </span>
      <span
        className={cn(
          "tabular ml-3 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
          variant === "secondary" ? "bg-ticket/15 text-ticket" : "bg-black/15",
        )}
      >
        {option.disabled && option.reasonLabel ? (
          option.reasonLabel
        ) : (
          <>
            <Icon name="ticket" size={13} strokeWidth={2.4} />
            {formatNumber(option.cost)}枚
          </>
        )}
      </span>
    </button>
  );
}

export function DrawPanel({ className }: { className?: string }) {
  const { gacha, viewer, tickets, options, onSale, busy, loginHref, requestDraw, remaining } = useGachaPlay();
  const cheapest = options[0];
  const short = viewer !== null && tickets !== null && onSale && cheapest && tickets < cheapest.cost;

  return (
    <section aria-label="ガチャを引く" className={cn("rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>
      {viewer ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted">所持ガチャチケット</p>
            <Amount kind="ticket" value={tickets ?? 0} size="lg" icon />
          </div>
          <Link href="/earn" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-ticket hover:underline">
            チケットを貯める
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/8 px-3.5 py-3 text-sm">
          <p className="font-bold text-fg">ガチャを引くにはログインが必要です</p>
          <p className="mt-0.5 text-xs text-muted">無料会員登録でガチャチケットをプレゼント中！</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 px-1 text-xs">
        <span className="font-bold text-muted">1回あたり</span>
        <span className="inline-flex items-center gap-1 font-bold text-fg">
          <Icon name="ticket" size={14} className="text-ticket" />
          ガチャチケット {gacha.ticketCost}枚
        </span>
      </div>

      <div className="mt-3 hidden space-y-2.5 md:block">
        {!onSale ? (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-4 text-center">
            <p className="font-display text-xl text-fg">
              {unavailableLabel({ status: remaining.status, ended: gacha.ended, remaining: remaining.remainingSlots })}
            </p>
            {remaining.lastOneWinner && (
              <p className="mt-1 text-xs font-bold text-accent">ラストワン賞は{remaining.lastOneWinner.nickname}さんが獲得しました</p>
            )}
          </div>
        ) : !viewer ? (
          <>
            <ButtonLink href={loginHref} size="xl" fullWidth leftIcon="login">
              ログインして引く
            </ButtonLink>
            <ButtonLink href={`/register?next=${encodeURIComponent(`/gacha/${gacha.id}`)}`} variant="outline" size="lg" fullWidth>
              無料会員登録
            </ButtonLink>
          </>
        ) : (
          options.map((o) => <DrawButton key={o.key} option={o} busy={busy} onClick={() => requestDraw(o)} />)
        )}
      </div>

      {busy && (
        <p className="mt-3 hidden items-center justify-center gap-2 text-xs font-bold text-muted md:flex" role="status">
          <Spinner size={14} /> 抽選中…
        </p>
      )}

      {short && (
        <div className="mt-3 rounded-xl border border-warning/35 bg-warning/8 px-3.5 py-3 text-xs leading-relaxed text-fg/90">
          <p className="flex items-center gap-1.5 font-bold text-warning">
            <Icon name="alert" size={14} />
            チケットが不足しています
          </p>
          <p className="mt-1">動画視聴・案件・ログインボーナスでチケットを貯めましょう。</p>
          <Link href="/earn" className="mt-1.5 inline-flex items-center gap-0.5 font-bold text-ticket hover:underline">
            チケットを貯める
            <Icon name="chevronRight" size={13} />
          </Link>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle md:hidden">
        <Icon name="info" size={12} className="mt-0.5 shrink-0" />
        ガチャは画面下のボタンから引けます。
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Phones: sticky bar above the bottom tab bar
// ---------------------------------------------------------------------------

export function MobileDrawBar() {
  const { viewer, tickets, options, onSale, busy, loginHref, requestDraw, remaining, gacha } = useGachaPlay();
  const [footerVisible, setFooterVisible] = useState(false);
  const counts = options.filter((o) => o.kind === "count");
  const all = options.find((o) => o.kind === "all");

  // Slide away when the site footer is on screen so it stays readable.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const tall = onSale && !!viewer && !!all;

  return (
    <>
      <div aria-hidden="true" className={cn(tall ? "h-44" : "h-32", "md:hidden")} />
      <div
        className={cn(
          "fixed inset-x-0 z-30 transition-transform duration-300 md:hidden",
          footerVisible && "pointer-events-none translate-y-[calc(100%+5rem)]",
        )}
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="border-t border-line bg-bg/95 px-3 pb-2.5 pt-2 shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5 text-[11px]">
            {viewer ? (
              <span className="inline-flex items-center gap-1 font-bold text-muted">
                所持
                <Amount kind="ticket" value={tickets ?? 0} size="xs" icon />
              </span>
            ) : (
              <span className="font-bold text-muted">ログインして挑戦しよう</span>
            )}
            <span className="tabular font-bold text-muted">
              残り <span className="text-fg">{formatNumber(remaining.remainingSlots)}</span>口
            </span>
          </div>

          {!onSale ? (
            <div className="grid h-12 place-items-center rounded-xl border border-line bg-surface-2 text-sm font-black text-muted">
              {unavailableLabel({ status: remaining.status, ended: gacha.ended, remaining: remaining.remainingSlots })}
            </div>
          ) : !viewer ? (
            <ButtonLink href={loginHref} size="lg" fullWidth leftIcon="login">
              ログインして引く
            </ButtonLink>
          ) : (
            <>
              {all && (
                <button
                  type="button"
                  onClick={() => requestDraw(all)}
                  disabled={all.disabled || busy}
                  className={cn(buttonClasses("gold", "lg", true), "mb-2 justify-between px-4", !all.disabled && "animate-pulse-glow")}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon name="crown" size={18} filled />
                    {all.label}
                  </span>
                  <span className="tabular text-xs font-black opacity-85">{all.disabled ? all.reasonLabel : `${formatNumber(all.cost)}枚`}</span>
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {counts.map((o) => {
                  const variant = o.highlight ? "gold" : o.count >= 100 ? "gold" : o.count >= 10 ? "primary" : "secondary";
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => requestDraw(o)}
                      disabled={o.disabled || busy}
                      className={cn(buttonClasses(variant, "lg", true), "h-14 flex-col gap-0 rounded-xl px-1 leading-tight")}
                    >
                      <span className="text-[15px] font-black">{o.highlight ? "ラスト1口" : o.short}</span>
                      <span className="tabular text-[10px] font-bold opacity-85">
                        {o.disabled && o.reasonLabel ? o.reasonLabel : `${formatNumber(o.cost)}枚`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
