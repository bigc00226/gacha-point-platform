import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/store";
import { AdminShell } from "@/components/admin/admin-shell";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "管理画面", template: "%s｜管理画面｜ポイガチャ DEMO" },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const db = getDb();
  let pendingOrders = 0;
  for (const order of db.orders.values()) if (order.status === "pending") pendingOrders++;

  return (
    <div className="theme-admin min-h-dvh">
      <ToastProvider>
        <AdminShell adminName={admin.nickname} badges={{ pendingOrders }}>
          {children}
        </AdminShell>
      </ToastProvider>
      <div id="app-portal" />
    </div>
  );
}
