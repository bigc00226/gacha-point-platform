import Link from "next/link";
import type { PublicUser } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

/** Balances are always shown as two separate chips: ガチャチケット (cyan) and ポイント (gold). */
function BalanceChips({ user }: { user: PublicUser }) {
  return (
    <Link
      href="/mypage"
      className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface/80 p-1 pr-1.5 transition-colors hover:border-line-strong"
      aria-label={`ガチャチケット ${formatNumber(user.tickets)}枚、ポイント ${formatNumber(user.points)}pt`}
    >
      <span className="flex items-center gap-1 rounded-xl bg-ticket/12 px-2 py-1">
        <Icon name="ticket" size={14} className="text-ticket" strokeWidth={2.3} />
        <span className="tabular text-xs font-black text-ticket sm:text-sm">{formatNumber(user.tickets)}</span>
        <span className="hidden text-[10px] font-bold text-ticket/80 sm:inline">枚</span>
      </span>
      <span className="flex items-center gap-1 rounded-xl bg-point/12 px-2 py-1">
        <Icon name="coin" size={14} className="text-point" strokeWidth={2.3} />
        <span className="tabular text-xs font-black text-point sm:text-sm">{formatNumber(user.points)}</span>
        <span className="hidden text-[10px] font-bold text-point/80 sm:inline">pt</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ user, siteName }: { user: PublicUser | null; siteName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo siteName={siteName} />
          <NavLinks />
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <BalanceChips user={user} />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                ログイン
              </ButtonLink>
              <ButtonLink href="/register" variant="primary" size="sm">
                無料登録
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function AnnouncementBar({ text, link }: { text: string; link?: { href: string; label: string } }) {
  return (
    <div className="border-b border-accent/20 bg-linear-to-r from-accent/12 via-primary/10 to-accent/12">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-[11px] font-medium leading-snug text-fg/90 sm:text-xs">
        <Icon name="megaphone" size={14} className="shrink-0 text-accent" />
        <span>
          {text}
          {link && (
            <Link href={link.href} className="ml-1.5 inline-flex items-center gap-0.5 whitespace-nowrap font-bold text-accent underline-offset-2 hover:underline">
              {link.label}
              <Icon name="arrowRight" size={12} />
            </Link>
          )}
        </span>
      </p>
    </div>
  );
}
