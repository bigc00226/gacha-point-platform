import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listUsersAdmin } from "@/lib/server/services/admin-users";
import { PageHeader } from "@/components/ui/misc";
import { UsersTable } from "@/components/admin/users/users-table";

export const metadata: Metadata = { title: "会員管理" };

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = listUsersAdmin();
  return (
    <>
      <PageHeader icon="users" title="会員管理" description={`全${users.length}名の会員情報、チケット・ポイント残高、付与・消費履歴を確認できます。`} />
      <UsersTable users={users} />
    </>
  );
}
