import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { getRewardSettingsPage } from "@/lib/server/services/rewards-admin";
import { PageHeader } from "@/components/ui/misc";
import { RewardSettingsForm } from "@/components/admin/rewards/reward-settings-form";

export const metadata: Metadata = { title: "チケット付与設定" };

export default async function AdminRewardsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="sliders"
        title="チケット付与設定"
        description="動画視聴・案件達成・ログインボーナスで付与するガチャチケットの枚数と、動画の1日上限回数を設定します。保存した内容は次の付与からすぐに反映されます。"
      />
      <RewardSettingsForm initial={getRewardSettingsPage()} />
    </>
  );
}
