import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listOrdersAdmin } from "@/lib/server/services/exchange";
import { PageHeader } from "@/components/ui/misc";
import { OrdersManager } from "@/components/admin/exchange/orders-manager";

export const metadata: Metadata = { title: "発送管理" };

export default async function AdminOrdersPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="truck"
        title="発送管理"
        description="ポイント交換の申請と、ガチャで当たった実物景品の発送依頼を管理します。お届け先の確認、発送ステータス（未発送／発送済）の更新、宛名のCSV出力ができます。"
      />
      <OrdersManager initial={listOrdersAdmin()} />
    </>
  );
}
