"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

interface RedeemResult {
  points: number;
  balances: { tickets: number; points: number };
  coupon: { displayCode: string; type: "single" | "shared"; label: string };
}

/** シリアルコード / あいことば input. Points are credited immediately. */
export function CouponRedeem({ className }: { className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await api.post<RedeemResult>("/api/coupons/redeem", { code });
      setMessage({ tone: "success", text: `「${res.coupon.displayCode}」で ${formatNumber(res.points)}pt を獲得しました！（残高 ${formatNumber(res.balances.points)}pt）` });
      toast.success(`${formatNumber(res.points)}ptを獲得しました！`);
      setCode("");
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={className} aria-labelledby="coupon-heading">
      <div className="relative overflow-hidden rounded-2xl border border-point/30 bg-linear-to-br from-point/10 via-surface to-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-point/15 text-point">
            <Icon name="coupon" size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="coupon-heading" className="text-base font-black text-fg">
              クーポンコードを入力
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              DMで届いたシリアルコードや、公式Xで告知された「あいことば」を入力すると、ポイントがすぐに付与されます。
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例: PG-XXXX-XXXX / WELCOME"
            aria-label="クーポンコード"
            autoComplete="off"
            autoCapitalize="characters"
            className="font-mono"
            maxLength={40}
          />
          <Button type="submit" variant="gold" loading={pending} disabled={!code.trim()} className="shrink-0">
            受け取る
          </Button>
        </form>
        {message && (
          <p className={`mt-2.5 flex items-start gap-1.5 text-xs font-bold ${message.tone === "success" ? "text-success" : "text-danger"}`} role={message.tone === "error" ? "alert" : "status"}>
            <Icon name={message.tone === "success" ? "checkCircle" : "alert"} size={14} className="mt-px shrink-0" />
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
