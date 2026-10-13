import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getUserDetailAdmin } from "@/lib/server/services/admin-users";
import { Icon } from "@/components/ui/icon";
import { UserDetail } from "@/components/admin/users/user-detail";

export const metadata: Metadata = { title: "会員詳細" };

export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = getUserDetailAdmin(id);
  if (!detail) notFound();
  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-fg">
        <Icon name="chevronLeft" size={16} />
        会員一覧
      </Link>
      <UserDetail key={detail.user.id} initial={detail} selfId={admin.id} />
    </>
  );
}
