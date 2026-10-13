import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui/misc";
import { MediaManager } from "@/components/admin/media/media-manager";

export const metadata: Metadata = { title: "メディアライブラリ" };

export default async function AdminMediaPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="image"
        title="メディアライブラリ"
        description="ガチャのサムネイル、景品画像、ランクのロゴ、演出動画（MP4）・Lottieアニメーションを管理します。アップロードしたファイルはガチャ・ランク設定などから選択して使えます。"
      />
      <MediaManager />
    </>
  );
}
