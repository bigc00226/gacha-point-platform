import type { IconName } from "@/components/ui/icon";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Key for a count badge supplied by the layout. */
  badge?: "pendingOrders";
}

export const ADMIN_NAV: Array<{ group: string; items: AdminNavItem[] }> = [
  {
    group: "",
    items: [{ href: "/admin", label: "ダッシュボード", icon: "gauge" }],
  },
  {
    group: "ガチャ運営",
    items: [
      { href: "/admin/gachas", label: "ガチャ管理", icon: "capsule" },
      { href: "/admin/ranks", label: "ランク・演出設定", icon: "sparkles" },
      { href: "/admin/media", label: "メディアライブラリ", icon: "image" },
    ],
  },
  {
    group: "ポイ活",
    items: [
      { href: "/admin/rewards", label: "チケット付与設定", icon: "sliders" },
      { href: "/admin/offers", label: "案件管理", icon: "smartphone" },
      { href: "/admin/postbacks", label: "成果通知ログ", icon: "signal" },
    ],
  },
  {
    group: "ポイント・景品",
    items: [
      { href: "/admin/coupons", label: "クーポンコード", icon: "coupon" },
      { href: "/admin/exchange-items", label: "交換景品", icon: "gift" },
      { href: "/admin/orders", label: "発送管理", icon: "truck", badge: "pendingOrders" },
    ],
  },
  {
    group: "会員",
    items: [{ href: "/admin/users", label: "会員管理", icon: "users" }],
  },
  {
    group: "システム",
    items: [
      { href: "/admin/loadtest", label: "負荷・整合性テスト", icon: "flask" },
      { href: "/admin/minigames", label: "ミニゲーム枠", icon: "gamepad" },
      { href: "/admin/settings", label: "サイト設定", icon: "server" },
    ],
  },
];
