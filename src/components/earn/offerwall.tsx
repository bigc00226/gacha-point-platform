"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { OfferCategory } from "@/lib/types";
import { OFFER_CATEGORY_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useScrollFade } from "@/components/ui/use-scroll-fade";
import type { OfferCompleteDto, OfferDto } from "./types";
import { VerificationPanel } from "./verification-panel";

const CATEGORY_ICONS: Record<OfferCategory, IconName> = {
  app: "smartphone",
  game: "gamepad",
  survey: "clipboard",
  signup: "user",
  shopping: "store",
  card: "wallet",
};

type Step = "detail" | "working" | "verifying" | "done";

function OfferIcon({ offer, size = 56 }: { offer: OfferDto; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!offer.iconUrl || failed) {
    return (
      <span className="grid shrink-0 place-items-center rounded-2xl bg-surface-3 text-primary" style={{ width: size, height: size }}>
        <Icon name={CATEGORY_ICONS[offer.category]} size={size / 2.2} />
      </span>
    );
  }
  return (
    <img
      src={offer.iconUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-2xl shadow-lg shadow-black/30"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

export function Offerwall({ offers, loggedIn, multiplier }: { offers: OfferDto[]; loggedIn: boolean; multiplier: number }) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState<OfferCategory | "all">("all");
  const chipsRef = useRef<HTMLDivElement>(null);
  const chipsFade = useScrollFade(chipsRef);
  const [selected, setSelected] = useState<OfferDto | null>(null);
  const [step, setStep] = useState<Step>("detail");
  const [result, setResult] = useState<OfferCompleteDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = (Object.keys(OFFER_CATEGORY_LABELS) as OfferCategory[]).filter((c) => offers.some((o) => o.category === c));
  const shown = category === "all" ? offers : offers.filter((o) => o.category === category);
  const open = selected !== null;
  const busy = step === "working" || step === "verifying";

  function openOffer(offer: OfferDto) {
    setSelected(offer);
    setStep("detail");
    setResult(null);
    setError(null);
  }

  function close() {
    if (busy) return;
    setSelected(null);
    if (result?.result.granted) router.refresh();
  }

  async function complete() {
    if (!selected) return;
    setError(null);
    setResult(null);
    setStep("working");
    // A short beat where the member "completes" the offer on the advertiser's side.
    await new Promise((r) => window.setTimeout(r, 1400));
    setStep("verifying");
    try {
      const res = await api.post<OfferCompleteDto>("/api/demo/offerwall/complete", { offerId: selected.id });
      setResult(res);
    } catch (err) {
      setStep("detail");
      if (err instanceof ApiClientError && err.status === 401) {
        toast.warning("ログインが必要です");
        router.push("/login?next=/earn");
        return;
      }
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <div ref={chipsRef} style={chipsFade} className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="カテゴリ">
        {(["all", ...categories] as const).map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(c)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
                active
                  ? "border-transparent bg-linear-to-r from-primary to-primary-2 text-white shadow-lg shadow-primary/25"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {c !== "all" && <Icon name={CATEGORY_ICONS[c]} size={14} />}
              {c === "all" ? "すべて" : OFFER_CATEGORY_LABELS[c]}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="smartphone" title="現在掲載中の案件はありません" className="rounded-2xl border border-line bg-surface" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((offer) => (
            <li key={offer.id} className="cv-auto [--cv-size:96px]">
              <button
                type="button"
                onClick={() => openOffer(offer)}
                className={cn(
                  "group flex w-full items-center gap-3.5 rounded-2xl border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 hover:border-line-strong",
                  offer.completed ? "border-line opacity-70" : "border-line",
                )}
              >
                <OfferIcon offer={offer} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral" size="xs">
                      {offer.providerLabel}
                    </Badge>
                    <Badge tone="info" size="xs" icon={CATEGORY_ICONS[offer.category]}>
                      {offer.categoryLabel}
                    </Badge>
                    {offer.repeatable && (
                      <Badge tone="success" size="xs">
                        毎日OK
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-sm font-black text-fg">{offer.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{offer.conditions}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {offer.completed ? (
                    <Badge tone="success" icon="check">
                      {offer.repeatable ? "本日達成" : "達成済み"}
                    </Badge>
                  ) : (
                    <>
                      {offer.multiplier !== 1 && (
                        <span className="rounded bg-danger px-1 text-[10px] font-black text-white">×{offer.multiplier}</span>
                      )}
                      <span className="tabular font-display text-xl leading-none text-ticket">+{formatNumber(offer.tickets)}</span>
                      <span className="text-[10px] font-bold text-ticket/80">チケット</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {multiplier !== 1 && (
        <p className="mt-3 text-xs font-bold text-danger">
          <Icon name="flame" size={13} className="mr-1 inline" />
          ただいま案件の付与数{multiplier}倍キャンペーン中！
        </p>
      )}

      <Modal
        open={open}
        onClose={close}
        title={selected?.title}
        size="md"
        hideCloseButton={busy}
        closeOnBackdrop={!busy}
        footer={
          selected && step === "detail" ? (
            <>
              <Button variant="secondary" onClick={close}>
                閉じる
              </Button>
              {loggedIn ? (
                <Button
                  variant="primary"
                  leftIcon="check"
                  onClick={complete}
                  disabled={selected.completed}
                >
                  {selected.completed ? (selected.repeatable ? "本日は達成済みです" : "達成済みです") : "案件を完了する（デモ）"}
                </Button>
              ) : (
                <ButtonLink href="/login?next=/earn" leftIcon="login">
                  ログインして挑戦
                </ButtonLink>
              )}
            </>
          ) : step === "done" ? (
            <Button variant="primary" onClick={close} fullWidth>
              閉じる
            </Button>
          ) : undefined
        }
      >
        {selected && step === "detail" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <OfferIcon offer={selected} size={64} />
              <div className="min-w-0">
                <p className="text-xs text-muted">{selected.providerLabel} ・ {selected.categoryLabel}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="tabular font-display text-3xl text-ticket">+{formatNumber(selected.tickets)}</span>
                  <span className="text-sm font-bold text-ticket">チケット</span>
                </p>
                {selected.multiplier !== 1 && (
                  <p className="text-[11px] text-muted">
                    通常 {formatNumber(selected.baseTickets)}枚 × キャンペーン倍率 {selected.multiplier}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-fg/90">{selected.description}</p>
            <div className="divide-y divide-line rounded-xl border border-line bg-surface-2 text-sm">
              <div className="flex gap-3 px-3.5 py-2.5">
                <span className="w-20 shrink-0 text-muted">達成条件</span>
                <span className="font-bold text-fg">{selected.conditions}</span>
              </div>
              <div className="flex gap-3 px-3.5 py-2.5">
                <span className="w-20 shrink-0 text-muted">目安時間</span>
                <span className="text-fg">{selected.estimatedTime}</span>
              </div>
              <div className="flex gap-3 px-3.5 py-2.5">
                <span className="w-20 shrink-0 text-muted">回数</span>
                <span className="text-fg">{selected.repeatable ? "1日1回まで" : "おひとり様1回まで"}</span>
              </div>
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            <Notice tone="neutral" icon="info">
              本番では skyflag / Tapjoy のオファーウォール画面（SDK・iframe）を表示し、広告主側で条件を達成すると
              <span className="font-bold text-fg">配信会社のサーバーから成果通知（署名付き）</span>
              が届いた時点でチケットを付与します。デモでは「案件を完了する」で成果通知を再現します。
            </Notice>
          </div>
        )}
        {selected && step === "working" && (
          <div className="grid place-items-center gap-4 py-10 text-center">
            <OfferIcon offer={selected} size={72} />
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-bold text-fg">
                <Spinner size={16} />
                広告主のサービスで条件を達成しています…
              </p>
              <p className="mt-1 text-xs text-muted">{selected.conditions}</p>
            </div>
          </div>
        )}
        {selected && (step === "verifying" || step === "done") && (
          <VerificationPanel
            kind="offer"
            providerLabel={selected.providerLabel}
            result={result?.result ?? null}
            balanceAfter={result?.balances.tickets ?? null}
            onRevealed={() => {
              setStep("done");
              if (result?.result.granted) toast.success(`チケット${result.result.ticketsGranted}枚を獲得しました！`);
            }}
          />
        )}
      </Modal>

      {!loggedIn && (
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login?next=/earn" className="font-bold text-primary hover:underline">
            ログイン
          </Link>
          すると案件に挑戦できます
        </p>
      )}
    </div>
  );
}
