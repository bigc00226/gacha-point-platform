import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/server/auth";
import { demoToolsEnabled } from "@/lib/server/demo";
import { toPublicUser } from "@/lib/server/dto";
import { getDb } from "@/lib/server/store";
import { LoginBonusPrompt } from "@/components/earn/login-bonus-prompt";
import { BottomNav } from "@/components/site/bottom-nav";
import { DemoToolsPanel } from "@/components/site/demo-tools-panel";
import { SiteFooter } from "@/components/site/site-footer";
import { AnnouncementBar, SiteHeader } from "@/components/site/site-header";
import { ToastProvider } from "@/components/ui/toast";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const { siteSettings } = getDb();
  const publicUser = user ? toPublicUser(user) : null;
  const demoTools = demoToolsEnabled();

  return (
    <div className="theme-site site-backdrop flex min-h-dvh flex-col">
      <ToastProvider>
        {siteSettings.announcement && (
          <AnnouncementBar text={siteSettings.announcement} link={demoTools ? { href: "/guide", label: "デモのご案内" } : undefined} />
        )}
        <SiteHeader user={publicUser} siteName={siteSettings.siteName} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-5 sm:px-6 sm:pt-7">{children}</main>
        <SiteFooter />
        <BottomNav loggedIn={!!user} />
        {user && <LoginBonusPrompt userId={user.id} />}
        {demoTools && <DemoToolsPanel user={publicUser} />}
      </ToastProvider>
      <div id="app-portal" />
    </div>
  );
}
