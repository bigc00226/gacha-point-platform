"use client";

import { useState } from "react";
import type { PostbackKind } from "@/lib/types";
import { cn, formatNumber } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Burst, Rays, TicketArt } from "./celebration";
import type { VerificationResultDto } from "./types";
import { VERIFICATION_PLANS, VerificationTimeline } from "./verification-timeline";
import styles from "./earn.module.css";

function FlowNode({ icon, title, sub, tone }: { icon: IconName; title: string; sub: string; tone: "provider" | "server" }) {
  return (
    <div className="flex w-[34%] min-w-0 flex-col items-center text-center">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-2xl ring-1 ring-inset",
          tone === "provider" ? "bg-ticket/12 text-ticket ring-ticket/35" : "bg-success/12 text-success ring-success/35",
        )}
      >
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-1.5 truncate text-[11px] font-bold text-fg">{title}</p>
      <p className="truncate text-[10px] text-subtle">{sub}</p>
    </div>
  );
}

/** Provider server → our server, with a packet travelling while the notification is in flight. */
export function ServerFlow({
  providerLabel,
  kind,
  state,
}: {
  providerLabel: string;
  kind: PostbackKind;
  state: "sending" | "received" | "rejected";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/70 px-3 py-3">
      <div className="flex items-start justify-between gap-1">
        <FlowNode icon="signal" title={providerLabel} sub={kind === "video" ? "広告配信サーバー" : "成果管理サーバー"} tone="provider" />
        <div className="flex flex-1 flex-col items-center pt-3">
          <p className="mb-1.5 whitespace-nowrap text-[10px] font-bold text-ticket">
            {kind === "video" ? "署名付き 視聴完了通知" : "署名付き 成果通知"}
          </p>
          <div className={cn(styles.wire, "w-full")}>
            {state === "sending" && <span className={styles.packet} />}
          </div>
          <p
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold",
              state === "sending" ? "text-muted" : state === "received" ? "text-success" : "text-danger",
            )}
          >
            {state === "sending" ? (
              <>
                <Spinner size={10} /> 送信中
              </>
            ) : state === "received" ? (
              <>
                <Icon name="check" size={11} strokeWidth={3} /> 受信・検証
              </>
            ) : (
              <>
                <Icon name="ban" size={11} strokeWidth={2.5} /> 受信・拒否
              </>
            )}
          </p>
        </div>
        <FlowNode icon="shieldCheck" title="ポイガチャ" sub="サーバーで検証" tone="server" />
      </div>
    </div>
  );
}

/** Raw notification as received (for the curious / technical stakeholders). */
export function CallbackDetails({ result }: { result: VerificationResultDto }) {
  return (
    <details className="group rounded-xl border border-line bg-surface-2/60 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-bold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="code" size={14} />
          受信した通知の中身を見る
        </span>
        <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-2.5">
        <p className="break-all font-mono text-[11px] text-ticket">
          {result.callback.method} {result.callback.url.split("?")[0]}
        </p>
        <dl className="space-y-1 font-mono text-[11px]">
          {Object.entries(result.callback.params).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-28 shrink-0 text-subtle">{key}</dt>
              <dd className="min-w-0 break-all text-fg/90">
                {key === "signature" && value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] leading-relaxed text-muted">
          HTTP {result.httpStatus}・{result.postbackId}
          <br />
          この通知は広告ネットワーク／オファーウォール事業者のサーバーから届くもので、ブラウザでは作成できません。
        </p>
      </div>
    </details>
  );
}

function RewardBox({
  result,
  balanceAfter,
  kind,
}: {
  result: VerificationResultDto;
  balanceAfter: number | null;
  kind: PostbackKind;
}) {
  if (result.granted) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-accent/40 bg-linear-to-b from-accent/15 via-primary/10 to-transparent px-4 pb-5 pt-6 text-center">
        <Rays />
        <Burst count={36} />
        <div className="relative flex flex-col items-center">
          <TicketArt amount={result.ticketsGranted} size="md" tilt={-6} float />
          <p className={cn("mt-4 font-display text-4xl text-gradient-gold", styles.rewardPop)}>
            +{formatNumber(result.ticketsGranted)}
            <span className="ml-1 text-xl">枚</span>
          </p>
          <p className="mt-1 text-sm font-bold text-fg">ガチャチケットを獲得しました！</p>
          {balanceAfter !== null && (
            <p className="mt-1 text-xs text-muted">
              所持チケット <span className="tabular font-bold text-ticket">{formatNumber(balanceAfter)}枚</span>
            </p>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-[11px] font-bold text-success ring-1 ring-inset ring-success/30">
            <Icon name="shieldCheck" size={13} />
            {kind === "video" ? "視聴完了通知をサーバーで検証済み" : "成果通知をサーバーで検証済み"}
          </p>
        </div>
      </div>
    );
  }
  const limit = result.status === "limit_reached";
  return (
    <div className="rounded-3xl border border-danger/35 bg-danger/8 px-4 py-5 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger/15 text-danger">
        <Icon name={limit ? "ban" : "xCircle"} size={24} />
      </span>
      <p className="mt-3 text-base font-black text-fg">チケットは付与されませんでした</p>
      <p className="mt-1 text-sm text-muted">{result.message}</p>
      {limit && kind === "video" && <p className="mt-1 text-xs text-subtle">視聴回数は毎日0:00（日本時間）にリセットされます。</p>}
    </div>
  );
}

/**
 * The anti-cheat moment: shows the provider → server notification, animates the
 * verification steps and then reveals the reward (or the reason it was rejected).
 */
export function VerificationPanel({
  kind,
  providerLabel,
  result,
  balanceAfter,
  onRevealed,
}: {
  kind: PostbackKind;
  providerLabel: string;
  /** null while the provider's notification is still on its way. */
  result: VerificationResultDto | null;
  balanceAfter: number | null;
  onRevealed?: () => void;
}) {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const revealed = result !== null && revealedId === result.postbackId;
  const flowState = result === null ? "sending" : revealed && !result.granted ? "rejected" : "received";

  return (
    <div className="space-y-4">
      <ServerFlow providerLabel={providerLabel} kind={kind} state={flowState} />
      <div className="rounded-2xl border border-line bg-surface px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-black text-fg">
            <Icon name="shield" size={16} className="text-success" />
            サーバー側の検証
          </p>
          {result === null ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
              <Spinner size={12} /> 通知を待っています
            </span>
          ) : revealed ? (
            <span className={cn("text-[11px] font-bold", result.granted ? "text-success" : "text-danger")}>
              {result.granted ? "すべて通過" : "拒否"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-info">
              <Spinner size={12} /> 検証中
            </span>
          )}
        </div>
        {result === null ? (
          <VerificationTimeline key="waiting" steps={[]} plan={VERIFICATION_PLANS[kind]} dense />
        ) : (
          <VerificationTimeline
            key={result.postbackId}
            steps={result.steps}
            plan={VERIFICATION_PLANS[kind]}
            animate
            dense
            onDone={() => {
              setRevealedId(result.postbackId);
              onRevealed?.();
            }}
          />
        )}
      </div>
      {result && revealed && (
        <div className="animate-fade-up space-y-3">
          <RewardBox result={result} balanceAfter={balanceAfter} kind={kind} />
          <CallbackDetails result={result} />
        </div>
      )}
    </div>
  );
}
