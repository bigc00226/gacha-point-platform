import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { newGachaTemplate } from "@/lib/server/services/admin-gacha";
import { listRanksAdmin } from "@/lib/server/services/ranks";
import { PageHeader } from "@/components/ui/misc";
import { GachaEditor } from "@/components/admin/gacha/gacha-editor";

export const metadata: Metadata = { title: "ガチャを作成" };

export default async function AdminGachaNewPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader icon="plus" title="ガチャを作成" description="下書きで保存して、内容を確認してから公開できます。" />
      <GachaEditor gacha={newGachaTemplate()} ranks={listRanksAdmin()} />
    </>
  );
}
