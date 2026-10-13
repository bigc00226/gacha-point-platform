import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listAdminGachas } from "@/lib/server/services/admin-gacha";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { GachasTable } from "@/components/admin/gacha/gachas-table";

export const metadata: Metadata = { title: "ガチャ管理" };

export default async function AdminGachasPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="capsule"
        title="ガチャ管理"
        description="ガチャの追加・削除、景品と当選確率の設定、総口数・ラストワン賞の管理を行います。変更はユーザー画面にすぐ反映されます。"
        actions={
          <ButtonLink href="/admin/gachas/new" leftIcon="plus">
            新規作成
          </ButtonLink>
        }
      />
      <GachasTable rows={listAdminGachas()} />
    </>
  );
}
