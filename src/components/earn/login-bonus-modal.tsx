"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { Burst, Rays, TicketArt } from "./celebration";
import { Overlay } from "./overlay";
import { StreakStamps } from "./streak-stamps";
import type { LoginBonusClaimDto } from "./types";
import styles from "./earn.module.css";

/** The modal opens automatically at most once per JST day per member (remembered in this browser). */
function shownToday(storageKey: string, todayKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) === todayKey;
  } catch {
    return false;
  }
}

export function LoginBonusModal({
  userId,
  todayKey,
  tickets,
  nextStreak,
}: {
  userId: string;
  todayKey: string;
  tickets: number;
  nextStreak: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const storageKey = `poigacha:login-bonus-shown:${userId}`;
  const [open, setOpen] = useState(() => !shownToday(storageKey, todayKey));
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<LoginBonusClaimDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(storageKey, todayKey);
    } catch {
      // Without storage the modal may show again on the next full page load — acceptable.
    }
  }, [open, storageKey, todayKey]);

  function close() {
    setOpen(false);
    // The layout only renders this prompt while today's bonus is unclaimed: refresh once the
    // celebration is dismissed so the header balance updates and the prompt goes away.
    if (result) router.refresh();
  }

  async function claim() {
    setClaiming(true);
    setError(null);
    try {
      setResult(await api.post<LoginBonusClaimDto>("/api/rewards/login-bonus"));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "ALREADY_CLAIMED") {
        toast.info("本日のログインボーナスは受け取り済みです");
        setOpen(false);
        router.refresh();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Overlay
      open={open}
      label="ログインボーナス"
      onEscape={close}
      className="grid animate-fade-in place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={close} />
      <div className="relative w-full max-w-[400px] animate-pop-in overflow-hidden rounded-[28px] border border-accent/30 bg-surface shadow-[0_30px_80px_-20px_rgba(255,62,138,0.45)]">
        <div className="relative h-44 overflow-hidden bg-linear-to-b from-[#40208f] via-[#2a1766] to-surface">
          <Rays />
          {result && <Burst count={40} spread={1.2} />}
          <span className="absolute left-4 top-4 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-black tracking-[0.2em] text-accent ring-1 ring-inset ring-accent/40">
            DAILY BONUS
          </span>
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/25 text-white/85 transition-colors hover:bg-black/45 hover:text-white"
            aria-label="閉じる"
          >
            <Icon name="x" size={18} />
          </button>
          <div className="absolute inset-0 grid place-items-center pt-4">
            <TicketArt amount={tickets} size="lg" float tilt={-7} />
          </div>
        </div>

        <div className="px-5 pb-5 pt-1 text-center">
          {!result ? (
            <>
              <p className="font-display text-[28px] leading-tight text-gradient-gold">ログインボーナス！</p>
              <p className="mt-1 text-base font-bold text-fg">
                ガチャチケット<span className="mx-0.5 text-xl font-black text-ticket">{formatNumber(tickets)}枚</span>をプレゼント
              </p>
              <p className="mt-1 text-xs text-muted">
                {nextStreak > 1 ? (
                  <>
                    <Icon name="flame" size={13} className="mr-0.5 inline text-primary" />
                    <span className="font-bold text-fg">{nextStreak}日連続</span>ログイン達成！
                  </>
                ) : (
                  "今日から連続ログイン記録をはじめましょう"
                )}
              </p>
              <StreakStamps day={nextStreak} claimedToday={false} tickets={tickets} className="mt-4" />
              {error && (
                <Notice tone="danger" className="mt-4 text-left">
                  {error}
                </Notice>
              )}
              <Button variant="gold" size="xl" fullWidth leftIcon="gift" loading={claiming} onClick={claim} className="mt-5">
                受け取る
              </Button>
              <button
                type="button"
                onClick={close}
                className="mt-2 h-9 px-3 text-xs font-bold text-muted transition-colors hover:text-fg"
              >
                あとで受け取る（チケットを貯めるページからも受け取れます）
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-[26px] leading-tight text-gradient-gold">受け取りました！</p>
              <p className={cn("mt-1 font-display text-5xl text-ticket", styles.rewardPop)}>
                +{formatNumber(result.tickets)}
                <span className="ml-1 text-2xl">枚</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                所持チケット
                <span className="tabular mx-1 font-bold text-fg">{formatNumber(balance)}</span>→
                <span className="tabular ml-1 font-black text-ticket">{formatNumber(result.balances.tickets)}枚</span>
              </p>
              <StreakStamps day={result.streak} claimedToday tickets={result.tickets} animateToday className="mt-4" />
              <p className="mt-3 text-xs text-muted">
                <span className="font-bold text-fg">{result.streak}日連続</span>ログイン中！ 明日もお待ちしています。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" onClick={close}>
                  閉じる
                </Button>
                <ButtonLink href="/" variant="primary" size="lg" leftIcon="capsule" onClick={close}>
                  ガチャを引く
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
