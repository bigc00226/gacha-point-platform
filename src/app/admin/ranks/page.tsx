import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listRanksAdmin } from "@/lib/server/services/ranks";
import { PageHeader } from "@/components/ui/misc";
import { RanksManager } from "@/components/admin/ranks/ranks-manager";

export const metadata: Metadata = { title: "ランク・演出設定" };

export default async function AdminRanksPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="sparkles"
        title="ランク・演出設定"
        description="特賞〜D賞・ラストワン賞のロゴ画像と当選演出（内蔵アニメーション／MP4動画／Lottie）を設定します。演出ファイルはメディアライブラリからアップロードして紐付けられます。"
      />
      <RanksManager initial={listRanksAdmin()} />
    </>
  );
}
