"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ShippingAddress, UserPrize } from "@/lib/types";
import { EMPTY_ADDRESS, formatAddress, validateAddress, type AddressErrors } from "@/lib/address";
import { USER_PRIZE_STATUS_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { AddressForm } from "@/components/ui/address-form";
import { Badge, RankBadge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PrizeImage } from "@/components/gacha/prize-image";

type PrizeRow = UserPrize & { trackingNumber: string | null; shippedAt: string | null };
type Filter = "all" | "action" | "shipping" | "digital";

const STATUS_TONE: Record<UserPrize["status"], BadgeTone> = { owned: "warning", shipping_requested: "info", shipped: "success" };

export function PrizeBox({ prizes, lastAddress }: { prizes: PrizeRow[]; lastAddress: ShippingAddress | null }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [shipping, setShipping] = useState<PrizeRow | null>(null);
  const [address, setAddress] = useState<ShippingAddress>(lastAddress ?? EMPTY_ADDRESS);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = {
    all: prizes.length,
    action: prizes.filter((p) => p.type === "physical" && p.status === "owned").length,
    shipping: prizes.filter((p) => p.type === "physical" && p.status !== "owned").length,
    digital: prizes.filter((p) => p.type === "digital").length,
  };
  const shown = prizes.filter((p) =>
    filter === "all" ? true : filter === "action" ? p.type === "physical" && p.status === "owned" : filter === "shipping" ? p.type === "physical" && p.status !== "owned" : p.type === "digital",
  );

  function open(p: PrizeRow) {
    setShipping(p);
    setAddress(lastAddress ?? EMPTY_ADDRESS);
    setErrors({});
    setConfirmed(false);
    setError(null);
  }

  async function submit() {
    if (!shipping) return;
    const v = validateAddress(address);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    if (!confirmed) {
      setError("お届け先の内容を確認し、チェックを入れてください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post(`/api/prizes/${shipping.id}/ship`, { address });
      toast.success("発送を依頼しました", "発送状況は「交換・発送状況」で確認できます。");
      setShipping(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        const field = ((err.details as { field?: string } | undefined)?.field ?? "").replace("address.", "") as keyof ShippingAddress;
        setErrors(field ? { [field]: err.message } : {});
      }
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "すべて" },
    { key: "action", label: "発送手続きが必要" },
    { key: "shipping", label: "発送状況" },
    { key: "digital", label: "デジタル特典" },
  ];

  return (
    <div className="space-y-4">
      {counts.action > 0 && (
        <Notice tone="warning" title={`発送手続きが必要な景品が${counts.action}件あります`}>
          お届け先を入力して発送を依頼してください。
        </Notice>
      )}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
              filter === f.key ? "border-transparent bg-linear-to-r from-primary to-primary-2 text-white" : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label}
            <span className="tabular text-[11px] opacity-80">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="gift" title="該当する景品はありません" description="ガチャで当たったデジタル特典・実物景品がここに表示されます。" className="rounded-2xl border border-line bg-surface" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id} className={cn("flex gap-3.5 rounded-2xl border bg-surface p-3.5", p.isLastOne ? "border-accent/50" : "border-line")}>
              <div
                className="grid size-20 shrink-0 place-items-center rounded-xl"
                style={{ background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${p.rankColor} 30%, transparent), var(--surface-2) 70%)` }}
              >
                <PrizeImage src={p.imageUrl} alt="" className="size-16" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.isLastOne ? (
                    <Badge tone="gold" icon="crown" size="xs">
                      ラストワン賞
                    </Badge>
                  ) : (
                    <RankBadge name={p.rankName} color={p.rankColor} size="xs" />
                  )}
                  <Badge tone={p.type === "digital" ? "ticket" : "primary"} size="xs">
                    {p.type === "digital" ? "デジタル特典" : "実物景品"}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm font-black text-fg">{p.name}</p>
                <p className="text-[11px] text-subtle">
                  {p.gachaTitle} ・ {formatDateTime(p.createdAt)}
                </p>
                {p.type === "digital" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 truncate rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-ticket">{p.digitalCode}</code>
                    {p.digitalCode && <CopyButton text={p.digitalCode} />}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[p.status]}>{USER_PRIZE_STATUS_LABELS[p.status]}</Badge>
                    {p.status === "owned" && (
                      <Button size="xs" leftIcon="truck" onClick={() => open(p)}>
                        発送を依頼する
                      </Button>
                    )}
                    {p.trackingNumber && <span className="text-[11px] text-muted">追跡番号 {p.trackingNumber}</span>}
                    {p.shippedAt && <span className="text-[11px] text-muted">{formatDateTime(p.shippedAt)} 発送</span>}
                  </div>
                )}
                {p.pointValue > 0 && <p className="mt-1 text-[11px] text-subtle">参考価格 {formatNumber(p.pointValue)}pt相当</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!shipping}
        onClose={() => !pending && setShipping(null)}
        title="発送を依頼する"
        description={shipping ? `「${shipping.name}」のお届け先を入力してください。` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShipping(null)} disabled={pending}>
              キャンセル
            </Button>
            <Button leftIcon="truck" onClick={submit} loading={pending}>
              この内容で依頼する
            </Button>
          </>
        }
      >
        {shipping && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <PrizeImage src={shipping.imageUrl} alt="" className="size-12" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{shipping.name}</p>
                <p className="text-xs text-muted">{shipping.gachaTitle}</p>
              </div>
            </div>
            <AddressForm value={address} onChange={setAddress} errors={errors} disabled={pending} idPrefix="ship" />
            {Object.keys(validateAddress(address)).length === 0 && (
              <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
                <Icon name="mapPin" size={12} className="mr-1 inline" />
                {formatAddress(address)} {address.fullName} 様
              </p>
            )}
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="お届け先に間違いがないことを確認しました" description="発送後の住所変更はできません。" />
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        )}
      </Modal>
    </div>
  );
}
