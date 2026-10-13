import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listExchangeItemsAdmin } from "@/lib/server/services/exchange";
import { PageHeader } from "@/components/ui/misc";
import { ExchangeItemsManager } from "@/components/admin/exchange/exchange-items-manager";

export const metadata: Metadata = { title: "交換景品" };

export default async function AdminExchangeItemsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="gift"
        title="交換景品"
        description="ポイント交換所に並べる景品の追加・編集・在庫数の設定を行います。交換が申請されると在庫は自動で減り、発送管理に注文が届きます。"
      />
      <ExchangeItemsManager initial={listExchangeItemsAdmin()} />
    </>
  );
}
