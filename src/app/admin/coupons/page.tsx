import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listCouponsAdmin } from "@/lib/server/services/coupons";
import { PageHeader } from "@/components/ui/misc";
import { CouponsManager } from "@/components/admin/coupons/coupons-manager";

export const metadata: Metadata = { title: "クーポンコード" };

export default async function AdminCouponsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="coupon"
        title="クーポンコード（ポイント付与）"
        description="使い捨て型（DM配布用）と先着限定型（公式Xのあいことば等）のコードを発行・管理します。会員はマイページで入力すると即座にポイントが付与されます。"
      />
      <CouponsManager initial={listCouponsAdmin()} />
    </>
  );
}
