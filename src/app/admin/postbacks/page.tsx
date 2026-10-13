import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { requestOrigin } from "@/lib/server/origin";
import { listPostbacks, parsePostbackFilter, postbackTestOptions, webhookEndpoints } from "@/lib/server/services/rewards-admin";
import { PageHeader } from "@/components/ui/misc";
import { PostbacksViewer } from "@/components/admin/rewards/postbacks-viewer";

export const metadata: Metadata = { title: "成果通知ログ" };

export default async function AdminPostbacksPage() {
  await requireAdmin();
  const origin = await requestOrigin();
  return (
    <>
      <PageHeader
        icon="signal"
        title="成果通知ログ（Webhook）"
        description="広告配信会社・オファーウォールから届いた成果通知と、サーバー側の検証結果（署名・時刻・重複・セッション・上限）をすべて記録しています。"
      />
      <PostbacksViewer initial={listPostbacks(parsePostbackFilter({}), 1, 30)} endpoints={webhookEndpoints(origin)} testOptions={postbackTestOptions()} />
    </>
  );
}
