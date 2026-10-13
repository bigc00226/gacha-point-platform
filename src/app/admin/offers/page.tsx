import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listAdminOffers } from "@/lib/server/services/rewards-admin";
import { PageHeader } from "@/components/ui/misc";
import { OffersManager } from "@/components/admin/rewards/offers-manager";

export const metadata: Metadata = { title: "案件管理" };

export default async function AdminOffersPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="smartphone"
        title="案件管理（オファーウォール）"
        description="ユーザー画面の「案件に挑戦」に表示する案件を管理します。本番ではskyflag・Tapjoyの案件一覧と連携し、ここでは表示・停止や付与数の確認を行います。"
      />
      <OffersManager initial={listAdminOffers()} />
    </>
  );
}
