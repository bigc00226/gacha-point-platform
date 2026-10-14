import "server-only";
import type { AuditLog, User } from "@/lib/types";
import { recordAudit } from "../audit";
import { withLock } from "../lock";
import { stateStatus, type StateStatus } from "../state/sync";
import { getDb } from "../store";
import { vString } from "../validate";

/** When this Node process started (module-level timestamps would reflect lazy loading / dev reloads instead). */
function processStartedAt(): string {
  return new Date(Date.now() - process.uptime() * 1000).toISOString();
}

export interface SettingsPageDto {
  site: { siteName: string; tagline: string; announcement: string; updatedAt: string };
  env: {
    node: string;
    next: string;
    serverStartedAt: string;
    seededAt: string;
    demoTools: boolean;
    maxUploadMb: number;
    /** Where the demo data lives (this process's memory, or shared between instances). */
    state: StateStatus;
  };
  counts: Array<{ label: string; value: number }>;
  audits: AuditLog[];
}

export function getSettingsPage(nextVersion: string, maxUploadMb: number, demoTools: boolean): SettingsPageDto {
  const db = getDb();
  return {
    site: { ...db.siteSettings },
    env: {
      node: process.version,
      next: nextVersion,
      serverStartedAt: processStartedAt(),
      seededAt: db.seededAt,
      demoTools,
      maxUploadMb,
      state: stateStatus(),
    },
    counts: [
      { label: "会員", value: [...db.users.values()].filter((u) => !u.isVirtual).length },
      { label: "ガチャ", value: [...db.gachas.values()].filter((g) => !g.isSandbox).length },
      { label: "抽選履歴", value: db.draws.length },
      { label: "台帳（付与・消費履歴）", value: db.ledger.length },
      { label: "成果通知ログ", value: db.postbacks.length },
      { label: "注文", value: db.orders.size },
      { label: "クーポン", value: db.coupons.size },
      { label: "メディア", value: db.media.size },
    ],
    audits: [...db.auditLogs].reverse(),
  };
}

export async function updateSiteSettings(admin: User, body: Record<string, unknown>) {
  const siteName = vString(body.siteName, "siteName", "サイト名", { max: 30 });
  const tagline = vString(body.tagline, "tagline", "キャッチコピー", { optional: true, max: 80 });
  const announcement = vString(body.announcement, "announcement", "お知らせ", { optional: true, max: 120 });
  return withLock("site-settings", () => {
    const db = getDb();
    db.siteSettings = { siteName, tagline, announcement, updatedAt: new Date().toISOString() };
    recordAudit(db, admin, "サイト設定を変更", siteName, announcement ? `お知らせ: ${announcement}` : "お知らせ: 非表示");
    return db.siteSettings;
  });
}
