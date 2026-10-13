import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getGachaEdit } from "@/lib/server/services/admin-gacha";
import { listRanksAdmin } from "@/lib/server/services/ranks";
import { PageHeader } from "@/components/ui/misc";
import { GachaEditor } from "@/components/admin/gacha/gacha-editor";

export const metadata: Metadata = { title: "ガチャを編集" };

export default async function AdminGachaEditPage({ params }: PageProps<"/admin/gachas/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const gacha = getGachaEdit(id);
  if (!gacha) notFound();
  return (
    <>
      <PageHeader icon="edit" title={gacha.title} description={`ID: ${gacha.id} ／ 景品・確率・口数・ラストワン賞を編集できます。`} />
      <GachaEditor key={gacha.id ?? "new"} gacha={gacha} ranks={listRanksAdmin()} />
    </>
  );
}
