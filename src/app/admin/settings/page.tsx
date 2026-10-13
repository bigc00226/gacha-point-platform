import type { Metadata } from "next";
import nextPackage from "next/package.json";
import { requireAdmin } from "@/lib/server/auth";
import { demoToolsEnabled } from "@/lib/server/demo";
import { getSettingsPage } from "@/lib/server/services/admin-settings";
import { MEDIA_MAX_UPLOAD_MB } from "@/lib/server/services/media";
import { PageHeader } from "@/components/ui/misc";
import { SettingsView } from "@/components/admin/settings/settings-view";

export const metadata: Metadata = { title: "サイト設定" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader icon="server" title="サイト設定" description="サイト名・お知らせ、デモ環境の情報、管理者の操作ログを確認できます。" />
      <SettingsView data={getSettingsPage(nextPackage.version, MEDIA_MAX_UPLOAD_MB, demoToolsEnabled())} />
    </>
  );
}
