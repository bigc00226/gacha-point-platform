"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatCountdown } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { Burst } from "./celebration";
import { StreakStamps } from "./streak-stamps";
import type { LoginBonusClaimDto, LoginBonusStatusDto } from "./types";
import { useNow } from "./use-now";

export function LoginBonusCard({
  status,
  tickets,
  serverNow,
  className,
}: {
  /** null when signed out. */
  status: LoginBonusStatusDto | null;
  tickets: number;
  serverNow: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<LoginBonusClaimDto | null>(null);
  const now = useNow(Date.parse(serverNow));

  // Until the refreshed server props arrive, show the claim response.
  const current = status && !status.claimedToday && claimed?.loginBonus.todayKey === status.todayKey ? claimed.loginBonus : status;
  const isClaimed = current?.claimedToday ?? false;
  const reward = current?.tickets ?? tickets;
  const day = current ? (isClaimed ? current.streak : current.nextStreak) : 1;

  async function claim() {
    setClaiming(true);
    try {
      const res = await api.post<LoginBonusClaimDto>("/api/rewards/login-bonus");
      setClaimed(res);
      toast.success(`ログインボーナス ${formatNumber(res.tickets)}枚を受け取りました`, `${res.streak}日連続ログイン中です。明日もお待ちしています！`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "ALREADY_CLAIMED") {
        toast.info("本日分は受け取り済みです", "明日0:00（日本時間）以降にまた受け取れます。");
        router.refresh();
      } else {
        toast.error("受け取りに失敗しました", errorMessage(err));
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section
      aria-labelledby="login-bonus-title"
      className={cn("relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-6", className)}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/12 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-b from-[#fff1a8] via-[#ffc93d] to-[#f0960e] text-[#3a2100] shadow-lg shadow-[#ffb800]/25">
            <Icon name="gift" size={22} strokeWidth={2.2} />
          </span>
          <div>
            <h2 id="login-bonus-title" className="font-display text-xl leading-tight text-fg">
              ログインボーナス
            </h2>
            <p className="mt-0.5 text-xs text-muted">毎日ログインでガチャチケット{formatNumber(reward)}枚</p>
          </div>
        </div>
        {current && current.streak > 0 && (
          <Badge tone="gold" icon="flame" className="mt-1">
            {current.streak}日連続
          </Badge>
        )}
      </div>

      <StreakStamps
        day={day}
        claimedToday={isClaimed}
        tickets={reward}
        animateToday={claimed !== null}
        className="relative mt-5"
      />

      <div className="relative mt-5 flex flex-1 flex-col justify-end">
        {claimed && <Burst key={claimed.loginBonus.totalClaims} count={28} />}
        {!status ? (
          <ButtonLink href="/login?next=/earn" variant="gold" size="lg" fullWidth leftIcon="login">
            ログインして受け取る
          </ButtonLink>
        ) : isClaimed ? (
          <div className="rounded-2xl bg-surface-2 px-4 py-3 text-center ring-1 ring-inset ring-line">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="checkCircle" size={17} />
              本日分は受け取り済みです
            </p>
            <p className="mt-0.5 text-xs text-muted">
              次回は明日0:00から（あと{formatCountdown(current?.nextResetAt ?? serverNow, now)}）
            </p>
          </div>
        ) : (
          <Button variant="gold" size="lg" fullWidth leftIcon="gift" loading={claiming} onClick={claim}>
            受け取る（+{formatNumber(reward)}枚）
          </Button>
        )}
        {status && !isClaimed && (
          <p className="mt-2 text-center text-[11px] text-subtle">
            {day > 1 ? `受け取ると${day}日連続ログインになります` : "今日から連続ログイン記録をはじめましょう"}
          </p>
        )}
      </div>
    </section>
  );
}
