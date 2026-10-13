"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExchangeItem, Order, ShippingAddress } from "@/lib/types";
import { EMPTY_ADDRESS, formatAddress, validateAddress, type AddressErrors } from "@/lib/address";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { AddressForm } from "@/components/ui/address-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { PrizeImage } from "@/components/gacha/prize-image";

type Step = "confirm" | "address" | "done";

function Stepper({ step, physical }: { step: Step; physical: boolean }) {
  const steps: Array<{ key: Step; label: string }> = physical
    ? [
        { key: "confirm", label: "内容確認" },
        { key: "address", label: "お届け先" },
        { key: "done", label: "完了" },
      ]
    : [
        { key: "confirm", label: "内容確認" },
        { key: "done", label: "完了" },
      ];
  const current = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2" aria-label="交換の手順">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-black",
              i < current ? "bg-success text-white" : i === current ? "bg-linear-to-br from-[#ffd23f] to-[#f0960e] text-[#3a2100]" : "bg-surface-3 text-subtle",
            )}
          >
            {i < current ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn("text-xs font-bold", i === current ? "text-fg" : "text-subtle")}>{s.label}</span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

export function ExchangeFlow({
  item,
  viewer,
}: {
  item: ExchangeItem;
  viewer: { points: number; lastAddress: ShippingAddress | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const physical = item.type === "physical";
  const [step, setStep] = useState<Step>("confirm");
  const [address, setAddress] = useState<ShippingAddress>(viewer?.lastAddress ?? EMPTY_ADDRESS);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [saveAddress, setSaveAddress] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);

  const soldOut = item.stock <= 0;
  const points = viewer?.points ?? 0;
  const short = item.pointsRequired - points;
  const canExchange = !!viewer && !soldOut && short <= 0;

  async function submit() {
    if (physical) {
      const v = validateAddress(address);
      setErrors(v);
      if (Object.keys(v).length > 0) return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await api.post<{ order: Order; balances: { points: number } }>("/api/exchange", {
        itemId: item.id,
        address: physical ? address : undefined,
        saveAddress,
      });
      setOrder(res.order);
      setBalanceAfter(res.balances.points);
      setStep("done");
      toast.success("交換が完了しました", item.name);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        const field = ((err.details as { field?: string } | undefined)?.field ?? "").replace("address.", "") as keyof ShippingAddress;
        if (field) setErrors({ [field]: err.message });
      }
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_50%_40%,rgba(255,197,61,0.25),transparent_65%),var(--surface)]">
          <PrizeImage src={item.imageUrl} alt={item.name} className="size-[68%] animate-float" loading="eager" />
          <Badge tone={physical ? "primary" : "ticket"} className="absolute left-4 top-4">
            {physical ? "実物景品（ご自宅へ発送）" : "デジタル（すぐに発行）"}
          </Badge>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl leading-tight text-fg">{item.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="tabular font-display text-4xl leading-none text-point">
              {formatNumber(item.pointsRequired)}
              <span className="ml-1 text-lg">pt</span>
            </p>
            <p className="pb-0.5 text-sm text-muted">{soldOut ? "在庫切れ" : `残り ${formatNumber(item.stock)}点`}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5">
          <Stepper step={step} physical={physical} />

          {step === "confirm" && (
            <div className="mt-5 space-y-4">
              {viewer ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-surface-2 p-4 text-center">
                  <div>
                    <p className="text-[11px] font-bold text-muted">現在のポイント</p>
                    <p className="tabular text-lg font-black text-point">{formatNumber(points)}pt</p>
                  </div>
                  <Icon name="arrowRight" size={18} className="text-subtle" />
                  <div>
                    <p className="text-[11px] font-bold text-muted">交換後</p>
                    <p className={cn("tabular text-lg font-black", short > 0 ? "text-danger" : "text-fg")}>
                      {short > 0 ? "不足" : `${formatNumber(points - item.pointsRequired)}pt`}
                    </p>
                  </div>
                </div>
              ) : (
                <Notice tone="info">交換するにはログインしてください。</Notice>
              )}
              {viewer && short > 0 && !soldOut && (
                <Notice tone="warning" title={`あと${formatNumber(short)}pt必要です`}>
                  ポイントはガチャの当選やクーポンコードで獲得できます。
                </Notice>
              )}
              {soldOut && <Notice tone="danger">申し訳ありません。この景品は在庫切れです。</Notice>}
              {error && <Notice tone="danger">{error}</Notice>}
              {!viewer ? (
                <ButtonLink href={`/login?next=/exchange/${item.id}`} size="lg" fullWidth leftIcon="login">
                  ログインして交換する
                </ButtonLink>
              ) : physical ? (
                <Button variant="gold" size="lg" fullWidth rightIcon="arrowRight" disabled={!canExchange} onClick={() => setStep("address")}>
                  お届け先の入力へ
                </Button>
              ) : (
                <Button variant="gold" size="lg" fullWidth leftIcon="gift" disabled={!canExchange} loading={pending} onClick={submit}>
                  {formatNumber(item.pointsRequired)}ptで交換する
                </Button>
              )}
              <p className="text-[11px] leading-relaxed text-subtle">
                ※交換後のキャンセル・返品はできません。{physical ? "発送は申込から通常3〜7営業日です（デモのため実際の発送は行われません）。" : "ギフトコードは交換後すぐに表示されます（デモ用のダミーコードです）。"}
              </p>
            </div>
          )}

          {step === "address" && (
            <div className="mt-5 space-y-4">
              <AddressForm value={address} onChange={setAddress} errors={errors} disabled={pending} idPrefix="ex" />
              <Checkbox checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} label="この住所を次回も使う" />
              {Object.keys(validateAddress(address)).length === 0 && (
                <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
                  <Icon name="mapPin" size={12} className="mr-1 inline" />
                  {formatAddress(address)} {address.fullName} 様
                </p>
              )}
              {error && <Notice tone="danger">{error}</Notice>}
              <div className="flex gap-2">
                <Button variant="secondary" size="lg" onClick={() => setStep("confirm")} disabled={pending}>
                  戻る
                </Button>
                <Button variant="gold" size="lg" className="flex-1" leftIcon="gift" loading={pending} onClick={submit}>
                  {formatNumber(item.pointsRequired)}ptで交換する
                </Button>
              </div>
            </div>
          )}

          {step === "done" && order && (
            <div className="mt-6 space-y-4 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success">
                <Icon name="checkCircle" size={34} />
              </span>
              <div>
                <p className="font-display text-xl text-fg">交換が完了しました！</p>
                <p className="mt-1 text-sm text-muted">
                  注文番号 {order.id.slice(-8).toUpperCase()} ・ 残りポイント{" "}
                  <span className="font-black text-point">{formatNumber(balanceAfter ?? 0)}pt</span>
                </p>
              </div>
              {order.digitalCode ? (
                <div className="rounded-2xl border border-ticket/30 bg-ticket/8 p-4">
                  <p className="text-xs font-bold text-muted">ギフトコード</p>
                  <p className="mt-1 font-mono text-lg font-black tracking-wider text-ticket">{order.digitalCode}</p>
                  <CopyButton text={order.digitalCode} className="mt-2" />
                </div>
              ) : (
                <Notice tone="info" className="text-left">
                  発送の準備ができ次第お届けします。発送状況はマイページの「交換・発送状況」で確認できます。
                </Notice>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <ButtonLink href="/mypage?tab=orders" variant="primary" className="flex-1" leftIcon="truck">
                  交換・発送状況を見る
                </ButtonLink>
                <ButtonLink href="/exchange" variant="secondary" className="flex-1">
                  景品一覧に戻る
                </ButtonLink>
              </div>
            </div>
          )}
        </div>

        <Link href="/exchange" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
          <Icon name="chevronLeft" size={16} />
          景品一覧へ
        </Link>
      </div>
    </div>
  );
}
