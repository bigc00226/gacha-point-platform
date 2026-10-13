import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/server/auth";
import { listExchangeItems } from "@/lib/server/services/exchange";
import { formatNumber } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ExchangeCatalog } from "@/components/exchange/exchange-catalog";

export const metadata: Metadata = { title: "ポイント交換" };

export default async function ExchangePage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-point/30 bg-linear-to-br from-[#3a2a05] via-surface to-surface p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full bg-point/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-point/15 px-3 py-1 text-[11px] font-black tracking-widest text-point ring-1 ring-inset ring-point/35">
              <Icon name="gift" size={12} />
              POINT EXCHANGE
            </p>
            <h1 className="mt-3 font-display text-2xl text-fg sm:text-3xl">ポイント交換</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
              ガチャで当たったポイントを、ゲーム機やデジタルギフトなどの景品と交換できます。実物景品はご自宅へお届けします。
            </p>
          </div>
          {user ? (
            <div className="rounded-2xl border border-point/30 bg-bg/40 px-5 py-3">
              <p className="text-[11px] font-bold text-muted">所持ポイント</p>
              <p className="tabular font-display text-3xl leading-tight text-point">
                {formatNumber(user.points)}
                <span className="ml-1 text-base">pt</span>
              </p>
            </div>
          ) : (
            <ButtonLink href="/login?next=/exchange" variant="gold" leftIcon="login">
              ログインして交換
            </ButtonLink>
          )}
        </div>
      </section>
      <ExchangeCatalog items={listExchangeItems()} points={user ? user.points : null} />
    </div>
  );
}
