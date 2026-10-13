import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui/misc";
import { LoadTestView } from "@/components/admin/loadtest/loadtest-view";

export const metadata: Metadata = { title: "負荷・整合性テスト" };

export default async function AdminLoadTestPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="flask"
        title="負荷・整合性テスト"
        description="アクセス集中時（ラストワン終盤・SNSイベント時）でもデータの不整合が起きないことを、その場で検証できます。"
      />
      <LoadTestView />
    </>
  );
}
