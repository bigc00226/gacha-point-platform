import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  Coupon,
  DrawRecord,
  DrawResultItem,
  ExchangeItem,
  Gacha,
  LastOnePrize,
  MediaAsset,
  MediaKind,
  MiniGameSlot,
  Offer,
  OfferCategory,
  Order,
  OrderStatus,
  PostbackLog,
  Prize,
  PrizeType,
  Rank,
  RewardSettings,
  ShippingAddress,
  User,
  UserPrize,
  VerificationStep,
} from "@/lib/types";
import { normalizeCouponCode } from "@/lib/codes";
import { parseProbability } from "@/lib/probability";
import { addDaysToKey, jstDateKey, startOfJstDay } from "@/lib/time";
import { generateCouponCode, generateGiftCode, newId } from "./ids";
import { changePoints, changeTickets } from "./ledger";
import { drawPrizes, seededRandomInt, type RandomIntFn } from "./lottery";
import { hashPassword } from "./password";
import { signParams } from "./signature";
import type { Db } from "./store";

/**
 * Demo seed data. Deterministic (fixed PRNG seed) except that timestamps are
 * relative to the moment the server starts, so "today" always has activity.
 * Fixed ids are used for anything a URL or session cookie may reference.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEMO_USER_ID = "u_demo";
export const ADMIN_USER_ID = "u_admin";

interface Ctx {
  db: Db;
  now: number;
  rand: RandomIntFn;
}

const iso = (ms: number) => new Date(ms).toISOString();
const randInt = (rand: RandomIntFn, min: number, max: number) => min + rand(max - min + 1);
const pick = <T>(rand: RandomIntFn, items: readonly T[]): T => items[rand(items.length)];
const chance = (rand: RandomIntFn, p: number) => rand(1_000_000) < p * 1_000_000;

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

function seedRanks({ db, now }: Ctx) {
  const at = iso(now - 30 * DAY);
  const ranks: Array<Omit<Rank, "createdAt" | "updatedAt">> = [
    {
      id: "r_last",
      name: "ラストワン賞",
      subtitle: "LAST ONE",
      color: "#FFB800",
      order: 0,
      logoUrl: "/demo/rank/last.png",
      effect: { type: "video", url: "/demo/effects/lastone.mp4", builtinStyle: "lastone" },
      isLastOne: true,
    },
    {
      id: "r_s",
      name: "特賞",
      subtitle: "超大当たり",
      color: "#FFD43B",
      order: 1,
      logoUrl: "/demo/rank/s.png",
      effect: { type: "video", url: "/demo/effects/tokusho.mp4", builtinStyle: "rainbow" },
      isLastOne: false,
    },
    {
      id: "r_a",
      name: "A賞",
      subtitle: "大当たり",
      color: "#FF4D6D",
      order: 2,
      logoUrl: "/demo/rank/a.png",
      effect: { type: "lottie", url: "/demo/effects/a-burst.json", builtinStyle: "red" },
      isLastOne: false,
    },
    {
      id: "r_b",
      name: "B賞",
      subtitle: "中当たり",
      color: "#B05CFF",
      order: 3,
      logoUrl: "/demo/rank/b.png",
      effect: { type: "builtin", url: null, builtinStyle: "purple" },
      isLastOne: false,
    },
    {
      id: "r_c",
      name: "C賞",
      subtitle: "小当たり",
      color: "#3DA5FF",
      order: 4,
      logoUrl: "/demo/rank/c.png",
      effect: { type: "builtin", url: null, builtinStyle: "blue" },
      isLastOne: false,
    },
    {
      id: "r_d",
      name: "D賞",
      subtitle: "参加賞",
      color: "#9AA4B8",
      order: 5,
      logoUrl: "/demo/rank/d.png",
      effect: { type: "builtin", url: null, builtinStyle: "basic" },
      isLastOne: false,
    },
  ];
  for (const rank of ranks) db.ranks.set(rank.id, { ...rank, createdAt: at, updatedAt: at });
}

// ---------------------------------------------------------------------------
// Gachas & prizes
// ---------------------------------------------------------------------------

interface PrizeDef {
  key: string;
  rank: "r_s" | "r_a" | "r_b" | "r_c" | "r_d";
  name: string;
  description?: string;
  image: string;
  type: PrizeType;
  pointValue: number;
  /** null = fallback prize (receives the remaining probability). */
  prob: string | null;
  stock?: number | null;
  won?: number;
}

interface GachaDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  ticketCost: number;
  totalSlots: number;
  remainingSlots: number;
  status: Gacha["status"];
  badge: string | null;
  featured: boolean;
  sortOrder: number;
  endsInDays?: number;
  createdDaysAgo: number;
  lastOne: LastOnePrize | null;
  prizes: PrizeDef[];
}

const GACHAS: GachaDef[] = [
  {
    id: "g_dream",
    title: "ドリームガチャ",
    subtitle: "Switch 2を狙え！",
    description:
      "特賞は「Nintendo Switch 2」！A賞のワイヤレスイヤホンやデジタルギフトも当たる、いちばん人気のガチャです。最後の1口を引いた方には、ラストワン賞「Switch 2 ゴールドエディション」をプレゼント。",
    thumbnail: "/demo/gacha/dream.jpg",
    ticketCost: 1,
    totalSlots: 300_000,
    remainingSlots: 287_431,
    status: "active",
    badge: "PICK UP",
    featured: true,
    sortOrder: 1,
    createdDaysAgo: 21,
    lastOne: {
      name: "Switch 2 ゴールドエディション",
      description: "ラストワン賞だけの特別カラー。最後の1口を引いた方に贈呈します。",
      imageUrl: "/demo/prize/console-gold.svg",
      type: "physical",
      pointValue: 60_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "Nintendo Switch 2", description: "本体（カラーはお選びいただけません）", image: "/demo/prize/console.svg", type: "physical", pointValue: 50_000, prob: "1/100000", stock: 3 },
      { key: "a", rank: "r_a", name: "ワイヤレスイヤホン", description: "ノイズキャンセリング対応", image: "/demo/prize/earphones.svg", type: "physical", pointValue: 20_000, prob: "1/10000", stock: 30 },
      { key: "b", rank: "r_b", name: "デジタルギフト 1,000円分", description: "当選後すぐにギフトコードを発行", image: "/demo/prize/giftcard.svg", type: "digital", pointValue: 1_000, prob: "1/1000", stock: null },
      { key: "c1", rank: "r_c", name: "1,000pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 1_000, prob: "1/100" },
      { key: "c2", rank: "r_c", name: "100pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 100, prob: "1/10" },
      { key: "d", rank: "r_d", name: "10pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 10, prob: null },
    ],
  },
  {
    id: "g_goldrush",
    title: "ゴールドラッシュガチャ",
    subtitle: "ラストワン賞を狙え！",
    description:
      "まもなく完売！最後の1口を引いた方にラストワン賞「Nintendo Switch 2」をプレゼント。特賞は50,000ptです。",
    thumbnail: "/demo/gacha/goldrush.jpg",
    ticketCost: 1,
    totalSlots: 5_000,
    remainingSlots: 15,
    status: "active",
    badge: "ラストワン間近",
    featured: true,
    sortOrder: 2,
    createdDaysAgo: 18,
    lastOne: {
      name: "Nintendo Switch 2",
      description: "最後の1口を引いた方へのラストワン賞です。",
      imageUrl: "/demo/prize/console.svg",
      type: "physical",
      pointValue: 50_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "50,000pt", image: "/demo/prize/coin-xl.svg", type: "point", pointValue: 50_000, prob: "1/5000", stock: 1 },
      { key: "a", rank: "r_a", name: "10,000pt", image: "/demo/prize/coin-l.svg", type: "point", pointValue: 10_000, prob: "1/500", stock: 10, won: 8 },
      { key: "b", rank: "r_b", name: "3,000pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 3_000, prob: "1/50" },
      { key: "c", rank: "r_c", name: "500pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 500, prob: "1/10" },
      { key: "d", rank: "r_d", name: "50pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 50, prob: null },
    ],
  },
  {
    id: "g_demo",
    title: "演出確認ガチャ",
    subtitle: "デモ用・高確率",
    description:
      "【デモ専用】演出を確認するための高確率ガチャです。特賞（MP4動画演出）・A賞（Lottie演出）・B〜D賞（内蔵アニメーション）をお試しいただけます。A賞の実物景品で発送依頼の流れも確認できます。",
    thumbnail: "/demo/gacha/demo-effects.jpg",
    ticketCost: 1,
    totalSlots: 99_999,
    remainingSlots: 99_999,
    status: "active",
    badge: "DEMO",
    featured: false,
    sortOrder: 3,
    createdDaysAgo: 5,
    lastOne: {
      name: "デモ用ラストワン賞 50,000pt",
      description: "デモ用のラストワン賞です。",
      imageUrl: "/demo/prize/coin-xl.svg",
      type: "point",
      pointValue: 50_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "10,000pt", image: "/demo/prize/coin-xl.svg", type: "point", pointValue: 10_000, prob: "1/10" },
      { key: "a", rank: "r_a", name: "ワイヤレスイヤホン", description: "デモ用（実物景品の発送依頼をお試しいただけます）", image: "/demo/prize/earphones.svg", type: "physical", pointValue: 20_000, prob: "1/8" },
      { key: "b", rank: "r_b", name: "デジタルギフト 500円分", image: "/demo/exchange/gift-500.svg", type: "digital", pointValue: 500, prob: "1/5" },
      { key: "c", rank: "r_c", name: "300pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 300, prob: "1/4" },
      { key: "d", rank: "r_d", name: "30pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 30, prob: null },
    ],
  },
  {
    id: "g_halloween",
    title: "ハロウィン限定ガチャ",
    subtitle: "期間限定",
    description:
      "期間限定のハロウィンガチャ！特賞はデジタルギフト10,000円分。限定フィギュアやお菓子セットも当たります。1回3チケット。",
    thumbnail: "/demo/gacha/halloween.jpg",
    ticketCost: 3,
    totalSlots: 30_000,
    remainingSlots: 21_844,
    status: "active",
    badge: "期間限定",
    featured: true,
    sortOrder: 4,
    endsInDays: 14,
    createdDaysAgo: 10,
    lastOne: {
      name: "30,000pt",
      description: "ラストワン賞は30,000ptを即時付与します。",
      imageUrl: "/demo/prize/coin-xl.svg",
      type: "point",
      pointValue: 30_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "デジタルギフト 10,000円分", image: "/demo/prize/giftcard-premium.svg", type: "digital", pointValue: 10_000, prob: "1/3000", stock: 5 },
      { key: "a", rank: "r_a", name: "ハロウィン限定フィギュア", image: "/demo/prize/figure.svg", type: "physical", pointValue: 8_000, prob: "1/1000", stock: 20 },
      { key: "b", rank: "r_b", name: "お菓子詰め合わせ", image: "/demo/prize/candy.svg", type: "physical", pointValue: 3_000, prob: "1/300", stock: 100 },
      { key: "c", rank: "r_c", name: "500pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 500, prob: "1/30" },
      { key: "d", rank: "r_d", name: "20pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 20, prob: null },
    ],
  },
  {
    id: "g_points",
    title: "ポイント爆増ガチャ",
    subtitle: "最大100,000pt",
    description: "当たりはすべてポイント！貯めたポイントは「ポイント交換」で景品と交換できます。",
    thumbnail: "/demo/gacha/points.jpg",
    ticketCost: 1,
    totalSlots: 100_000,
    remainingSlots: 64_210,
    status: "active",
    badge: null,
    featured: false,
    sortOrder: 5,
    createdDaysAgo: 25,
    lastOne: {
      name: "30,000pt",
      description: "ラストワン賞は30,000ptを即時付与します。",
      imageUrl: "/demo/prize/coin-xl.svg",
      type: "point",
      pointValue: 30_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "100,000pt", image: "/demo/prize/coin-xl.svg", type: "point", pointValue: 100_000, prob: "1/50000", stock: 2 },
      { key: "a", rank: "r_a", name: "10,000pt", image: "/demo/prize/coin-l.svg", type: "point", pointValue: 10_000, prob: "1/2000" },
      { key: "b", rank: "r_b", name: "1,000pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 1_000, prob: "1/200" },
      { key: "c", rank: "r_c", name: "100pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 100, prob: "1/10" },
      { key: "d", rank: "r_d", name: "5pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 5, prob: null },
    ],
  },
  {
    id: "g_complete",
    title: "ゲーム機コンプリートガチャ",
    subtitle: "全ゲーム機セット",
    description: "完売しました。たくさんのご参加ありがとうございました！",
    thumbnail: "/demo/gacha/complete.jpg",
    ticketCost: 1,
    totalSlots: 10_000,
    remainingSlots: 0,
    status: "soldout",
    badge: null,
    featured: false,
    sortOrder: 6,
    createdDaysAgo: 40,
    lastOne: {
      name: "Switch 2 ゴールドエディション",
      description: "ラストワン賞だけの特別カラー。",
      imageUrl: "/demo/prize/console-gold.svg",
      type: "physical",
      pointValue: 60_000,
    },
    prizes: [
      { key: "s", rank: "r_s", name: "ゲーム機3台セット", image: "/demo/prize/console.svg", type: "physical", pointValue: 120_000, prob: "1/10000", stock: 1, won: 1 },
      { key: "a", rank: "r_a", name: "人気ゲームソフト", image: "/demo/prize/gamesoft.svg", type: "physical", pointValue: 6_000, prob: "1/500", stock: 20, won: 20 },
      { key: "b", rank: "r_b", name: "1,000pt", image: "/demo/prize/coin-m.svg", type: "point", pointValue: 1_000, prob: "1/50", won: 197 },
      { key: "c", rank: "r_c", name: "100pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 100, prob: "1/10", won: 1_004 },
      { key: "d", rank: "r_d", name: "10pt", image: "/demo/prize/coin-s.svg", type: "point", pointValue: 10, prob: null, won: 8_778 },
    ],
  },
];

function seedGachas({ db, now }: Ctx) {
  for (const def of GACHAS) {
    const createdAt = iso(now - def.createdDaysAgo * DAY);
    const endsAt =
      def.endsInDays !== undefined
        ? iso(startOfJstDay(now + def.endsInDays * DAY).getTime() + DAY - MIN) // 23:59 JST
        : null;
    db.gachas.set(def.id, {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      thumbnailUrl: def.thumbnail,
      ticketCost: def.ticketCost,
      totalSlots: def.totalSlots,
      remainingSlots: def.remainingSlots,
      status: def.status,
      badge: def.badge,
      featured: def.featured,
      sortOrder: def.sortOrder,
      lastOnePrize: def.lastOne,
      lastOneWinner: null,
      endsAt,
      createdAt,
      updatedAt: createdAt,
    });
    def.prizes.forEach((p, i) => {
      const parsed = p.prob ? parseProbability(p.prob) : null;
      if (parsed && !parsed.ok) throw new Error(`bad seed probability ${p.prob}`);
      const prize: Prize = {
        id: `p_${def.id.slice(2)}_${p.key}`,
        gachaId: def.id,
        rankId: p.rank,
        name: p.name,
        description: p.description ?? "",
        imageUrl: p.image,
        type: p.type,
        pointValue: p.pointValue,
        probabilityPpb: parsed && parsed.ok ? parsed.ppb : 0,
        probabilityInput: p.prob ?? "",
        isFallback: p.prob === null,
        stock: p.stock ?? null,
        wonCount: p.won ?? 0,
        sortOrder: i + 1,
      };
      db.prizes.set(prize.id, prize);
    });
  }
}

// ---------------------------------------------------------------------------
// Media library (built-in sample files under /public/demo)
// ---------------------------------------------------------------------------

const BUILTIN_MEDIA: Array<[url: string, name: string]> = [
  ["/demo/gacha/dream.jpg", "サムネイル_ドリームガチャ.jpg"],
  ["/demo/gacha/goldrush.jpg", "サムネイル_ゴールドラッシュ.jpg"],
  ["/demo/gacha/points.jpg", "サムネイル_ポイント爆増.jpg"],
  ["/demo/gacha/halloween.jpg", "サムネイル_ハロウィン.jpg"],
  ["/demo/gacha/demo-effects.jpg", "サムネイル_演出確認.jpg"],
  ["/demo/gacha/complete.jpg", "サムネイル_コンプリート.jpg"],
  ["/demo/banner/lastone.jpg", "バナー_ラストワン.jpg"],
  ["/demo/banner/earn.jpg", "バナー_チケットを貯める.jpg"],
  ["/demo/banner/halloween.jpg", "バナー_ハロウィン.jpg"],
  ["/demo/banner/coupon.jpg", "バナー_あいことば.jpg"],
  ["/demo/rank/s.png", "ロゴ_特賞.png"],
  ["/demo/rank/a.png", "ロゴ_A賞.png"],
  ["/demo/rank/b.png", "ロゴ_B賞.png"],
  ["/demo/rank/c.png", "ロゴ_C賞.png"],
  ["/demo/rank/d.png", "ロゴ_D賞.png"],
  ["/demo/rank/last.png", "ロゴ_ラストワン賞.png"],
  ["/demo/effects/tokusho.mp4", "演出_特賞.mp4"],
  ["/demo/effects/lastone.mp4", "演出_ラストワン.mp4"],
  ["/demo/effects/a-burst.json", "演出_A賞_lottie.json"],
  ["/demo/prize/console.svg", "景品_ゲーム機.svg"],
  ["/demo/prize/console-gold.svg", "景品_ゲーム機ゴールド.svg"],
  ["/demo/prize/earphones.svg", "景品_イヤホン.svg"],
  ["/demo/prize/giftcard.svg", "景品_ギフトカード.svg"],
  ["/demo/prize/giftcard-premium.svg", "景品_プレミアムギフト.svg"],
  ["/demo/prize/coin-s.svg", "景品_コイン小.svg"],
  ["/demo/prize/coin-m.svg", "景品_コイン中.svg"],
  ["/demo/prize/coin-l.svg", "景品_コイン大.svg"],
  ["/demo/prize/coin-xl.svg", "景品_コイン特大.svg"],
  ["/demo/prize/figure.svg", "景品_フィギュア.svg"],
  ["/demo/prize/candy.svg", "景品_お菓子.svg"],
  ["/demo/prize/gamesoft.svg", "景品_ゲームソフト.svg"],
  ["/demo/exchange/gift-500.svg", "交換_ギフト500.svg"],
  ["/demo/exchange/tshirt.svg", "交換_Tシャツ.svg"],
  ["/demo/exchange/battery.svg", "交換_バッテリー.svg"],
  ["/demo/exchange/coffee.svg", "交換_コーヒー.svg"],
  ["/demo/minigame/coin-catch.svg", "ミニゲーム_コインキャッチ.svg"],
  ["/demo/minigame/coming-soon.svg", "ミニゲーム_準備中.svg"],
];

const MIME_BY_EXT: Record<string, [MediaKind, string]> = {
  ".jpg": ["image", "image/jpeg"],
  ".jpeg": ["image", "image/jpeg"],
  ".png": ["image", "image/png"],
  ".svg": ["image", "image/svg+xml"],
  ".webp": ["image", "image/webp"],
  ".gif": ["image", "image/gif"],
  ".mp4": ["video", "video/mp4"],
  ".webm": ["video", "video/webm"],
  ".json": ["lottie", "application/json"],
};

function seedMedia({ db, now }: Ctx) {
  BUILTIN_MEDIA.forEach(([url, name], i) => {
    const ext = path.extname(url).toLowerCase();
    const [kind, mime] = MIME_BY_EXT[ext] ?? ["image", "application/octet-stream"];
    let size = 0;
    try {
      size = fs.statSync(path.join(process.cwd(), "public", url)).size;
    } catch {
      // Static files may live on a CDN in some deployments; size is informational.
    }
    const asset: MediaAsset = {
      id: `m_builtin_${String(i + 1).padStart(2, "0")}`,
      kind,
      name,
      mime,
      size,
      url,
      source: "builtin",
      createdAt: iso(now - 30 * DAY + i * MIN),
      uploadedBy: "運営管理者",
    };
    db.media.set(asset.id, asset);
  });
}

// ---------------------------------------------------------------------------
// Offers, rewards, exchange items, mini games, settings
// ---------------------------------------------------------------------------

const OFFERS: Array<Omit<Offer, "createdAt" | "active" | "sortOrder">> = [
  { id: "of_puzzle", provider: "skyflag", title: "ジュエルパズル・クエスト", description: "宝石をそろえて消す、爽快パズルゲーム。", category: "app", conditions: "新規インストール後、ステージ20をクリア", iconUrl: "/demo/offer/puzzle.svg", estimatedTime: "約30分", repeatable: false },
  { id: "of_rpg", provider: "skyflag", title: "ドラゴンソウル RPG", description: "美麗グラフィックの本格ファンタジーRPG。", category: "game", conditions: "新規インストール後、プレイヤーレベル10に到達", iconUrl: "/demo/offer/rpg.svg", estimatedTime: "約1時間", repeatable: false },
  { id: "of_survey5", provider: "skyflag", title: "かんたん5問アンケート", description: "1分で終わる日替わりアンケート。毎日回答できます。", category: "survey", conditions: "5問のアンケートにすべて回答", iconUrl: "/demo/offer/survey.svg", estimatedTime: "約1分", repeatable: true },
  { id: "of_lifestyle", provider: "tapjoy", title: "暮らしと家計のアンケート", description: "生活習慣についての20問アンケート。", category: "survey", conditions: "20問のアンケートにすべて回答", iconUrl: "/demo/offer/lifestyle.svg", estimatedTime: "約5分", repeatable: false },
  { id: "of_vod", provider: "tapjoy", title: "動画配信サービス 無料トライアル", description: "映画・ドラマ・アニメが見放題。", category: "signup", conditions: "31日間無料トライアルに新規登録", iconUrl: "/demo/offer/vod.svg", estimatedTime: "約3分", repeatable: false },
  { id: "of_card", provider: "skyflag", title: "年会費無料クレジットカード発行", description: "ポイント還元率1.0%の人気カード。", category: "card", conditions: "新規申込み後、カード発行完了", iconUrl: "/demo/offer/card.svg", estimatedTime: "約10分", repeatable: false },
  { id: "of_shop", provider: "tapjoy", title: "ファッション通販 初回購入", description: "トレンドアイテムが揃う通販サイト。", category: "shopping", conditions: "初回購入（税込2,000円以上）", iconUrl: "/demo/offer/shop.svg", estimatedTime: "約5分", repeatable: false },
  { id: "of_fitness", provider: "tapjoy", title: "ランニング記録アプリ", description: "GPSでランニングを記録できるアプリ。", category: "app", conditions: "新規インストール後、1km以上のランを記録", iconUrl: "/demo/offer/fitness.svg", estimatedTime: "約15分", repeatable: false },
];

function defaultRewardSettings(now: number): RewardSettings {
  return {
    videoTicketsPerView: 3,
    videoDailyLimit: 5,
    loginBonusTickets: 5,
    signupBonusTickets: 10,
    offerMultiplier: 1,
    offerCategoryTickets: { app: 50, game: 80, survey: 10, signup: 100, shopping: 200, card: 500 },
    updatedAt: iso(now - 5 * DAY),
    updatedBy: "運営管理者",
  };
}

const EXCHANGE_ITEMS: Array<Omit<ExchangeItem, "createdAt" | "updatedAt" | "active">> = [
  { id: "ex_switch2", name: "Nintendo Switch 2", description: "本体のみ。カラーはお選びいただけません。", imageUrl: "/demo/prize/console.svg", pointsRequired: 150_000, stock: 2, type: "physical", sortOrder: 1 },
  { id: "ex_earphones", name: "ワイヤレスイヤホン", description: "ノイズキャンセリング対応の完全ワイヤレスイヤホン。", imageUrl: "/demo/prize/earphones.svg", pointsRequired: 30_000, stock: 12, type: "physical", sortOrder: 2 },
  { id: "ex_gamesoft", name: "人気ゲームソフト（選べる）", description: "対象タイトルから1本お選びいただけます。", imageUrl: "/demo/prize/gamesoft.svg", pointsRequired: 60_000, stock: 5, type: "physical", sortOrder: 3 },
  { id: "ex_gift1000", name: "デジタルギフト 1,000円分", description: "交換後、マイページにギフトコードが表示されます。", imageUrl: "/demo/prize/giftcard.svg", pointsRequired: 10_000, stock: 100, type: "digital", sortOrder: 4 },
  { id: "ex_gift500", name: "デジタルギフト 500円分", description: "交換後、マイページにギフトコードが表示されます。", imageUrl: "/demo/exchange/gift-500.svg", pointsRequired: 5_000, stock: 200, type: "digital", sortOrder: 5 },
  { id: "ex_coffee", name: "カフェドリンク e-チケット", description: "全国のカフェで使えるドリンクチケット。", imageUrl: "/demo/exchange/coffee.svg", pointsRequired: 3_000, stock: 300, type: "digital", sortOrder: 6 },
  { id: "ex_tshirt", name: "ポイガチャ オリジナルTシャツ", description: "ここでしか手に入らない限定デザイン（M/L/XL）。", imageUrl: "/demo/exchange/tshirt.svg", pointsRequired: 8_000, stock: 30, type: "physical", sortOrder: 7 },
  { id: "ex_battery", name: "モバイルバッテリー", description: "10,000mAh・急速充電対応。", imageUrl: "/demo/exchange/battery.svg", pointsRequired: 12_000, stock: 0, type: "physical", sortOrder: 8 },
];

function seedCatalog({ db, now }: Ctx) {
  OFFERS.forEach((o, i) => db.offers.set(o.id, { ...o, active: true, sortOrder: i + 1, createdAt: iso(now - 20 * DAY) }));
  db.rewardSettings = defaultRewardSettings(now);
  for (const item of EXCHANGE_ITEMS) {
    const at = iso(now - 25 * DAY);
    db.exchangeItems.set(item.id, { ...item, active: true, createdAt: at, updatedAt: at });
  }
  const games: MiniGameSlot[] = [
    {
      id: "mg_coin",
      title: "コイン★キャッチ",
      description: "落ちてくるコインをキャッチしてハイスコアを目指そう！（自社サンプルゲーム）",
      provider: "サンプル（自社）",
      embedUrl: "/embed/coin-catch",
      thumbnailUrl: "/demo/minigame/coin-catch.svg",
      aspectRatio: "4:3",
      active: true,
      sortOrder: 1,
      createdAt: iso(now - 7 * DAY),
      updatedAt: iso(now - 7 * DAY),
    },
    {
      id: "mg_gmo",
      title: "外部ミニゲーム枠（GMO等）",
      description: "外部のポイ活ミニゲームを埋め込む枠です。管理画面で埋め込みURLを設定すると公開されます。",
      provider: "GMO（予定）",
      embedUrl: "",
      thumbnailUrl: "/demo/minigame/coming-soon.svg",
      aspectRatio: "16:9",
      active: true,
      sortOrder: 2,
      createdAt: iso(now - 7 * DAY),
      updatedAt: iso(now - 7 * DAY),
    },
  ];
  for (const game of games) db.miniGames.set(game.id, game);
  db.siteSettings = {
    siteName: "ポイガチャ",
    tagline: "ポイ活で貯めたチケットで、オリパ風ガチャに挑戦！",
    announcement: "【デモ環境】表示されるデータはすべてダミーです。実際の決済・発送・広告配信は行われません。",
    updatedAt: iso(now - 7 * DAY),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const NICKNAMES = [
  "ガチャ太郎", "いちご姫", "ポイ活マスター", "ねこまる", "夜更かしパンダ", "ラッキー7",
  "ゆるふわ主婦", "一攫千金", "ほしぞら", "たこやき大臣", "まったり勢", "甘党うさぎ",
  "爆死回避", "みかん", "さくらもち", "コツコツ貯金", "深夜のチャレンジャー", "はやぶさ",
  "しろくま", "ちょこ", "金運アップ", "ぽんず", "ひよこ豆", "モチベ高め",
  "最強の引き", "こつぶ", "ほっけ", "つばめ", "ドリーマー", "おにぎり",
  "シンデレラ", "ちゃんみ", "ゆうき", "そらまめ", "だいふく", "流れ星",
];

const FAMILY = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田"];
const GIVEN = ["太郎", "花子", "健太", "美咲", "翔", "結衣", "大輔", "陽菜", "拓海", "さくら", "蓮", "葵"];
const CITIES: Array<[string, string]> = [
  ["東京都", "渋谷区神南"], ["大阪府", "大阪市北区梅田"], ["神奈川県", "横浜市西区みなとみらい"],
  ["愛知県", "名古屋市中区栄"], ["福岡県", "福岡市博多区博多駅前"], ["北海道", "札幌市中央区北一条西"],
  ["宮城県", "仙台市青葉区一番町"], ["京都府", "京都市下京区四条通"], ["埼玉県", "さいたま市大宮区桜木町"],
];

function fakeAddress(rand: RandomIntFn, n: number): ShippingAddress {
  const [prefecture, city] = pick(rand, CITIES);
  return {
    fullName: `${pick(rand, FAMILY)} ${pick(rand, GIVEN)}`,
    postalCode: `${randInt(rand, 100, 999)}-${String(randInt(rand, 0, 9999)).padStart(4, "0")}`,
    prefecture,
    city,
    addressLine: `${randInt(rand, 1, 5)}-${randInt(rand, 1, 20)}-${randInt(rand, 1, 30)}`,
    building: chance(rand, 0.5) ? `サンプルハイツ${randInt(rand, 1, 9)}0${randInt(rand, 1, 9)}` : "",
    phone: `090-0000-${String(n).padStart(4, "0")}`,
  };
}

function newUser(id: string, email: string, nickname: string, passwordHash: string, createdAtMs: number): User {
  return {
    id,
    email,
    passwordHash,
    nickname,
    role: "user",
    status: "active",
    tickets: 0,
    points: 0,
    loginBonus: { lastClaimDate: null, streak: 0, totalClaims: 0 },
    videoViews: { date: jstDateKey(createdAtMs), count: 0 },
    lastAddress: null,
    createdAt: iso(createdAtMs),
    lastLoginAt: null,
  };
}

// ---------------------------------------------------------------------------
// Activity helpers (mirror what the live services record)
// ---------------------------------------------------------------------------

function grantLoginBonus(ctx: Ctx, user: User, atMs: number) {
  const { db } = ctx;
  const key = jstDateKey(atMs);
  const streak = user.loginBonus.lastClaimDate === addDaysToKey(key, -1) ? user.loginBonus.streak + 1 : 1;
  user.loginBonus = { lastClaimDate: key, streak, totalClaims: user.loginBonus.totalClaims + 1 };
  changeTickets(db, user, db.rewardSettings.loginBonusTickets, "login_bonus", `ログインボーナス（${streak}日連続）`, null, iso(atMs));
  user.lastLoginAt = iso(atMs);
}

function grantVideoReward(ctx: Ctx, user: User, atMs: number) {
  const { db, rand } = ctx;
  const key = jstDateKey(atMs);
  const count = user.videoViews.date === key ? user.videoViews.count : 0;
  if (count >= db.rewardSettings.videoDailyLimit) return;
  const tickets = db.rewardSettings.videoTicketsPerView;
  const sessionId = newId("as");
  const txId = `admob-${atMs.toString(36)}-${rand(0xffffff).toString(16).padStart(6, "0")}`;
  const postbackId = newId("pb");
  db.adSessions.set(sessionId, {
    id: sessionId,
    userId: user.id,
    network: "admob",
    status: "rewarded",
    createdAt: iso(atMs - 35_000),
    completedAt: iso(atMs),
    transactionId: txId,
    tickets,
  });
  const params: Record<string, string> = {
    ad_network: "5450213213286189855",
    ad_unit: "6300978111",
    custom_data: sessionId,
    key_id: "3335741209",
    reward_amount: String(tickets),
    reward_item: "ticket",
    timestamp: String(atMs - 1500),
    transaction_id: txId,
    user_id: user.id,
  };
  params.signature = signParams("admob", params);
  user.videoViews = { date: key, count: count + 1 };
  changeTickets(db, user, tickets, "video_reward", "動画視聴（リワード広告）", postbackId, iso(atMs));
  db.processedTransactions.add(`admob:${txId}`);
  db.postbacks.push({
    id: postbackId,
    kind: "video",
    provider: "admob",
    method: "GET",
    receivedAt: iso(atMs),
    userId: user.id,
    transactionId: txId,
    params,
    status: "granted",
    httpStatus: 200,
    ticketsGranted: tickets,
    steps: grantedSteps([
      ["session", "広告セッション照合", `視聴セッション ${sessionId} を確認`],
      ["limit", "1日の視聴上限", `本日 ${count + 1}/${db.rewardSettings.videoDailyLimit} 回目`],
    ], tickets),
    message: `チケット${tickets}枚を付与しました`,
    source: "simulator",
  });
}

function grantedSteps(extra: Array<[key: string, label: string, detail: string]>, tickets: number): VerificationStep[] {
  return [
    { key: "signature", label: "署名検証（HMAC-SHA256）", ok: true, detail: "署名が一致しました" },
    { key: "timestamp", label: "タイムスタンプ検証", ok: true, detail: "受信時刻との差 2秒（許容範囲: 5分）" },
    { key: "duplicate", label: "重複チェック（transaction_id）", ok: true, detail: "未処理のトランザクションです" },
    ...extra.map(([key, label, detail]) => ({ key, label, ok: true, detail })),
    { key: "grant", label: "チケット付与", ok: true, detail: `+${tickets}枚` },
  ];
}

function offerTickets(ctx: Ctx, category: OfferCategory): number {
  const s = ctx.db.rewardSettings;
  return Math.round(s.offerCategoryTickets[category] * s.offerMultiplier);
}

function grantOffer(ctx: Ctx, user: User, offer: Offer, atMs: number) {
  const { db, rand } = ctx;
  const tickets = offerTickets(ctx, offer.category);
  const txId = `${offer.provider}-${atMs.toString(36)}-${rand(0xffffff).toString(16).padStart(6, "0")}`;
  const postbackId = newId("pb");
  const params: Record<string, string> = {
    uid: user.id,
    offer_id: offer.id,
    tid: txId,
    category: offer.category,
    payout: String(randInt(rand, 30, 1500)),
    ts: String(Math.floor(atMs / 1000)),
  };
  params.signature = signParams(offer.provider, params);
  changeTickets(db, user, tickets, "offer_reward", `案件達成: ${offer.title}`, postbackId, iso(atMs));
  db.processedTransactions.add(`${offer.provider}:${txId}`);
  db.offerCompletions.push({
    id: newId("oc"),
    userId: user.id,
    offerId: offer.id,
    provider: offer.provider,
    transactionId: txId,
    tickets,
    createdAt: iso(atMs),
  });
  db.postbacks.push({
    id: postbackId,
    kind: "offer",
    provider: offer.provider,
    method: "GET",
    receivedAt: iso(atMs),
    userId: user.id,
    transactionId: txId,
    params,
    status: "granted",
    httpStatus: 200,
    ticketsGranted: tickets,
    steps: grantedSteps([
      ["offer", "案件照合", `${offer.title}（${offer.category}）`],
      ["rate", "付与数の計算", `カテゴリ設定 ${db.rewardSettings.offerCategoryTickets[offer.category]}枚 × 倍率 ${db.rewardSettings.offerMultiplier}`],
    ], tickets),
    message: `チケット${tickets}枚を付与しました`,
    source: "external",
  });
}

function redeemCoupon(ctx: Ctx, user: User, coupon: Coupon, atMs: number) {
  const { db } = ctx;
  coupon.usedCount += 1;
  changePoints(db, user, coupon.points, "coupon", `クーポンコード「${coupon.displayCode}」`, coupon.id, iso(atMs));
  db.couponRedemptions.push({
    id: newId("cr"),
    couponId: coupon.id,
    code: coupon.code,
    userId: user.id,
    userNickname: user.nickname,
    points: coupon.points,
    createdAt: iso(atMs),
  });
}

function orderFor(
  ctx: Ctx,
  user: User,
  fields: Pick<Order, "source" | "refId" | "itemName" | "imageUrl" | "itemType" | "pointsSpent">,
  atMs: number,
  status: OrderStatus,
  address: ShippingAddress | null,
): Order {
  const { db, rand, now } = ctx;
  const shippedAtMs = Math.min(now - HOUR, atMs + randInt(ctx.rand, 1, 3) * DAY);
  const order: Order = {
    id: newId("od"),
    userId: user.id,
    userNickname: user.nickname,
    ...fields,
    address: fields.itemType === "physical" ? address : null,
    status,
    trackingNumber:
      status === "shipped" && fields.itemType === "physical"
        ? `${randInt(rand, 1000, 9999)}-${randInt(rand, 1000, 9999)}-${randInt(rand, 1000, 9999)}`
        : null,
    digitalCode: fields.itemType === "digital" && status === "shipped" ? generateGiftCode(rand) : null,
    adminNote: "",
    createdAt: iso(atMs),
    updatedAt: iso(status === "pending" ? atMs : shippedAtMs),
    shippedAt: status === "shipped" ? iso(shippedAtMs) : null,
  };
  db.orders.set(order.id, order);
  return order;
}

function exchange(ctx: Ctx, user: User, item: ExchangeItem, atMs: number, status: OrderStatus, addressNo: number): Order | null {
  if (user.points < item.pointsRequired) return null;
  const address = item.type === "physical" ? user.lastAddress ?? fakeAddress(ctx.rand, addressNo) : null;
  const order = orderFor(
    ctx,
    user,
    {
      source: "exchange",
      refId: item.id,
      itemName: item.name,
      imageUrl: item.imageUrl,
      itemType: item.type,
      pointsSpent: item.pointsRequired,
    },
    atMs,
    status,
    address,
  );
  changePoints(ctx.db, user, -item.pointsRequired, "exchange", `ポイント交換: ${item.name}`, order.id, iso(atMs));
  return order;
}

/** Seeded (historical) draw. Slot numbers are assigned afterwards in finalizeDraws(). */
function seedDraw(
  ctx: Ctx,
  user: User,
  gachaId: string,
  count: number,
  atMs: number,
  forced: Record<number, string> = {},
): DrawRecord | null {
  const { db, rand } = ctx;
  const gacha = db.gachas.get(gachaId)!;
  const cost = gacha.ticketCost * count;
  if (user.tickets < cost) return null;
  const prizes = [...db.prizes.values()].filter((p) => p.gachaId === gachaId);
  const picks = drawPrizes(
    prizes.map((p) => ({
      id: p.id,
      probabilityPpb: p.probabilityPpb,
      isFallback: p.isFallback,
      stockLeft: p.stock === null ? null : p.stock - p.wonCount,
    })),
    count,
    rand,
  );
  for (const [index, prizeId] of Object.entries(forced)) {
    const prize = db.prizes.get(prizeId)!;
    const alreadyPicked = picks.filter((id) => id === prizeId).length;
    if (prize.stock === null || prize.stock - prize.wonCount - alreadyPicked > 0) picks[Number(index)] = prizeId;
  }

  const drawId = newId("dr");
  const at = iso(atMs);
  changeTickets(db, user, -cost, "gacha_draw", `${gacha.title}（${count}回）`, drawId, at);
  const results: DrawResultItem[] = picks.map((prizeId, i) => {
    const prize = db.prizes.get(prizeId)!;
    const rank = db.ranks.get(prize.rankId)!;
    prize.wonCount += 1;
    return {
      index: i + 1,
      slotNumber: 0,
      prizeId: prize.id,
      prizeName: prize.name,
      prizeImageUrl: prize.imageUrl,
      prizeType: prize.type,
      pointValue: prize.pointValue,
      rankId: rank.id,
      rankName: rank.name,
      rankColor: rank.color,
      rankOrder: rank.order,
    };
  });
  const pointsGained = results.reduce((sum, r) => (r.prizeType === "point" ? sum + r.pointValue : sum), 0);
  if (pointsGained > 0) {
    changePoints(db, user, pointsGained, "gacha_prize", `${gacha.title} 当選ポイント`, drawId, at);
  }
  for (const r of results) {
    if (r.prizeType === "point") continue;
    const box: UserPrize = {
      id: newId("up"),
      userId: user.id,
      gachaId,
      gachaTitle: gacha.title,
      drawId,
      prizeId: r.prizeId,
      isLastOne: false,
      name: r.prizeName,
      imageUrl: r.prizeImageUrl,
      rankName: r.rankName,
      rankColor: r.rankColor,
      type: r.prizeType,
      pointValue: r.pointValue,
      status: "owned",
      digitalCode: r.prizeType === "digital" ? generateGiftCode(rand) : null,
      orderId: null,
      createdAt: at,
    };
    db.userPrizes.set(box.id, box);
  }
  const record: DrawRecord = {
    id: drawId,
    requestId: `seed-${drawId}`,
    userId: user.id,
    userNickname: user.nickname,
    gachaId,
    gachaTitle: gacha.title,
    count,
    ticketCost: gacha.ticketCost,
    ticketsSpent: cost,
    pointsGained,
    results,
    lastOne: null,
    remainingAfter: 0,
    serverMs: Number((0.3 + rand(2500) / 1000 + count * 0.004).toFixed(2)),
    createdAt: at,
  };
  db.draws.push(record);
  db.drawRequests.set(`${user.id}:${record.requestId}`, drawId);
  return record;
}

/** Give historic draws consistent slot numbers: they are the most recent sold slots. */
function finalizeDraws({ db }: Ctx) {
  db.draws.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const gacha of db.gachas.values()) {
    const draws = db.draws.filter((d) => d.gachaId === gacha.id);
    const seeded = draws.reduce((sum, d) => sum + d.count, 0);
    let slot = gacha.totalSlots - gacha.remainingSlots - seeded;
    for (const draw of draws) {
      for (const result of draw.results) result.slotNumber = ++slot;
      draw.remainingAfter = gacha.totalSlots - slot;
    }
  }
}

/** Physical prizes of fake users: request shipping / ship the older ones. */
function processPrizeBoxes(ctx: Ctx) {
  const { db, rand, now } = ctx;
  let n = 100;
  for (const box of db.userPrizes.values()) {
    if (box.type !== "physical" || box.userId === DEMO_USER_ID) continue;
    const user = db.users.get(box.userId)!;
    const age = now - Date.parse(box.createdAt);
    if (age < 6 * HOUR || !chance(rand, 0.8)) continue;
    const address = user.lastAddress ?? fakeAddress(rand, n++);
    user.lastAddress = address;
    const shipped = age > 2 * DAY && chance(rand, 0.75);
    const order = orderFor(
      ctx,
      user,
      {
        source: "gacha_prize",
        refId: box.id,
        itemName: box.name,
        imageUrl: box.imageUrl,
        itemType: "physical",
        pointsSpent: 0,
      },
      Date.parse(box.createdAt) + randInt(rand, 1, 5) * HOUR,
      shipped ? "shipped" : "pending",
      address,
    );
    box.status = shipped ? "shipped" : "shipping_requested";
    box.orderId = order.id;
  }
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

function makeCoupon(
  ctx: Ctx,
  fields: Pick<Coupon, "type" | "displayCode" | "points" | "maxUses" | "label"> &
    Partial<Pick<Coupon, "usedCount" | "expiresAt" | "batchId" | "active">>,
  createdAtMs: number,
): Coupon {
  const coupon: Coupon = {
    id: newId("cp"),
    type: fields.type,
    code: normalizeCouponCode(fields.displayCode),
    displayCode: fields.displayCode,
    points: fields.points,
    maxUses: fields.maxUses,
    usedCount: fields.usedCount ?? 0,
    active: fields.active ?? true,
    expiresAt: fields.expiresAt ?? null,
    label: fields.label,
    batchId: fields.batchId ?? null,
    createdAt: iso(createdAtMs),
    createdBy: "運営管理者",
  };
  ctx.db.coupons.set(coupon.id, coupon);
  return coupon;
}

function seedCoupons(ctx: Ctx) {
  const { now, rand } = ctx;
  const welcome = makeCoupon(ctx, { type: "shared", displayCode: "WELCOME", points: 500, maxUses: 1000, usedCount: 230, label: "新規会員向け（サイト内告知）" }, now - 30 * DAY);
  makeCoupon(ctx, { type: "shared", displayCode: "ハロウィン2026", points: 1000, maxUses: 100, usedCount: 100, label: "公式X ハロウィン企画（先着100名・終了）" }, now - 9 * DAY);
  const poigacha = makeCoupon(ctx, { type: "shared", displayCode: "POIGACHA", points: 300, maxUses: 100, usedCount: 35, label: "公式X フォロワー限定", expiresAt: iso(now + 30 * DAY) }, now - 16 * DAY);
  const dmBatch = newId("cb");
  for (let i = 0; i < 8; i++) {
    makeCoupon(ctx, { type: "single", displayCode: generateCouponCode("PG", rand), points: 1000, maxUses: 1, label: "DM配布用（10月）", batchId: dmBatch, expiresAt: iso(now + 60 * DAY) }, now - 3 * DAY);
  }
  const vipBatch = newId("cb");
  for (let i = 0; i < 5; i++) {
    makeCoupon(ctx, { type: "single", displayCode: generateCouponCode("VIP", rand), points: 3000, maxUses: 1, label: "インフルエンサー配布用", batchId: vipBatch }, now - 1 * DAY);
  }
  return { welcome, poigacha, dmBatch };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function emptyDb(now: number): Db {
  return {
    schemaVersion: 0,
    seededAt: iso(now),
    users: new Map(),
    ranks: new Map(),
    gachas: new Map(),
    prizes: new Map(),
    draws: [],
    drawRequests: new Map(),
    userPrizes: new Map(),
    ledger: [],
    rewardSettings: defaultRewardSettings(now),
    offers: new Map(),
    offerCompletions: [],
    adSessions: new Map(),
    postbacks: [],
    processedTransactions: new Set(),
    coupons: new Map(),
    couponRedemptions: [],
    exchangeItems: new Map(),
    orders: new Map(),
    media: new Map(),
    mediaBlobs: new Map(),
    miniGames: new Map(),
    siteSettings: { siteName: "", tagline: "", announcement: "", updatedAt: iso(now) },
    auditLogs: [],
  };
}

export function buildSeedDb(): Db {
  const now = Date.now();
  const ctx: Ctx = { db: emptyDb(now), now, rand: seededRandomInt(20261013) };
  const { db, rand } = ctx;

  seedRanks(ctx);
  seedGachas(ctx);
  seedMedia(ctx);
  seedCatalog(ctx);
  const coupons = seedCoupons(ctx);

  // --- Accounts -------------------------------------------------------------
  const admin = newUser(ADMIN_USER_ID, "admin@demo.jp", "運営管理者", hashPassword("admin1234"), now - 60 * DAY);
  admin.role = "admin";
  db.users.set(admin.id, admin);
  changeTickets(db, admin, 1000, "demo_grant", "デモ用チケット付与", null, iso(now - 59 * DAY));
  changePoints(db, admin, 50_000, "demo_grant", "デモ用ポイント付与", null, iso(now - 59 * DAY));

  const demo = newUser(DEMO_USER_ID, "user@demo.jp", "デモユーザー", hashPassword("demo1234"), now - 20 * DAY);
  demo.lastAddress = {
    fullName: "デモ 太郎",
    postalCode: "150-0041",
    prefecture: "東京都",
    city: "渋谷区神南",
    addressLine: "1-2-3",
    building: "サンプルビル 501",
    phone: "090-1234-5678",
  };
  db.users.set(demo.id, demo);

  const sharedHash = hashPassword("password123");
  const fakes: Array<{ user: User; activity: number }> = NICKNAMES.map((nickname, i) => {
    const createdAtMs = now - randInt(rand, 8, 60) * DAY - randInt(rand, 0, 23) * HOUR;
    const user = newUser(`u_p${String(i + 1).padStart(2, "0")}`, `player${String(i + 1).padStart(2, "0")}@example.jp`, nickname, sharedHash, createdAtMs);
    db.users.set(user.id, user);
    return { user, activity: 0.35 + rand(55) / 100 };
  });

  // Every balance change is scheduled and then applied in time order, so the
  // running balances (balanceAfter) in each user's history are consistent.
  const events: Array<{ at: number; run: () => void }> = [];
  const schedule = (at: number, run: () => void) => events.push({ at, run });
  let addressNo = 1;
  const nextAddressNo = () => addressNo++;
  const offerNotDone = (user: User, ids: string[]) =>
    ids.map((id) => db.offers.get(id)!).find((o) => !db.offerCompletions.some((c) => c.userId === user.id && c.offerId === o.id));

  // --- Fake members: signup + 7 days of activity -----------------------------
  for (const { user } of fakes) {
    const createdMs = Date.parse(user.createdAt);
    schedule(createdMs, () =>
      changeTickets(db, user, db.rewardSettings.signupBonusTickets, "signup_bonus", "新規登録ボーナス", null, iso(createdMs)),
    );
    if (chance(rand, 0.35)) {
      const offer = db.offers.get(pick(rand, ["of_card", "of_shop", "of_vod"]))!;
      const at = createdMs + randInt(rand, 1, 20) * HOUR;
      schedule(at, () => grantOffer(ctx, user, offer, at));
    }
    if (chance(rand, 0.5)) {
      const at = createdMs + randInt(rand, 1, 20) * HOUR + 7 * MIN;
      schedule(at, () => redeemCoupon(ctx, user, coupons.welcome, at));
    }
  }

  const gachaPool: Array<[string, number]> = [
    ["g_dream", 45],
    ["g_points", 25],
    ["g_halloween", 22],
    ["g_goldrush", 8],
  ];
  const pickGacha = () => {
    let r = rand(100);
    for (const [id, weight] of gachaPool) {
      if (r < weight) return id;
      r -= weight;
    }
    return "g_dream";
  };

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const dayStart = startOfJstDay(now - daysAgo * DAY).getTime();
    const dayEnd = Math.max(dayStart, Math.min(dayStart + DAY - MIN, now - 5 * MIN));
    const span = Math.max(MIN, dayEnd - dayStart);
    for (const { user, activity } of fakes) {
      if (!chance(rand, activity)) continue;
      let t = dayStart + Math.floor((randInt(rand, 6 * 60, 20 * 60) / (24 * 60)) * span);
      const step = () => (t = Math.min(dayEnd, t + randInt(rand, 2, 35) * MIN));
      const loginAt = t;
      schedule(loginAt, () => grantLoginBonus(ctx, user, loginAt));
      const videos = randInt(rand, 0, 5);
      for (let v = 0; v < videos; v++) {
        const at = step();
        schedule(at, () => grantVideoReward(ctx, user, at));
      }
      if (chance(rand, 0.12)) {
        const offerId = pick(rand, ["of_puzzle", "of_rpg", "of_survey5", "of_lifestyle", "of_fitness"]);
        const at = step();
        schedule(at, () => {
          const offer = db.offers.get(offerId)!;
          const done = db.offerCompletions.some((c) => c.userId === user.id && c.offerId === offer.id);
          if (offer.repeatable || !done) grantOffer(ctx, user, offer, at);
        });
      }
      const requests = randInt(rand, 0, 3);
      for (let r = 0; r < requests; r++) {
        const roll = rand(100);
        const count = roll < 40 ? 1 : roll < 88 ? 10 : 100;
        const gachaId = pickGacha();
        const at = step();
        schedule(at, () => void seedDraw(ctx, user, gachaId, count, at));
      }
      if (chance(rand, 0.15)) {
        const itemId = pick(rand, ["ex_coffee", "ex_coffee", "ex_gift500", "ex_gift500", "ex_tshirt", "ex_gift1000"]);
        const at = step();
        schedule(at, () => void exchange(ctx, user, db.exchangeItems.get(itemId)!, at, daysAgo >= 1 ? "shipped" : "pending", nextAddressNo()));
      }
    }
  }

  // A few memorable wins for the "recent winners" feed (each preceded by an offer reward).
  const memorable: Array<[user: User, gachaId: string, atMs: number, forced: Record<number, string>]> = [
    [fakes[3].user, "g_halloween", now - 21 * HOUR, { 2: "p_halloween_s" }],
    [fakes[8].user, "g_goldrush", now - 5 * HOUR, { 4: "p_goldrush_a" }],
    [fakes[0].user, "g_points", now - 2 * HOUR - 12 * MIN, { 6: "p_points_a" }],
    [fakes[24].user, "g_halloween", now - 50 * MIN, { 8: "p_halloween_a" }],
  ];
  for (const [user, gachaId, atMs, forced] of memorable) {
    schedule(atMs - 40 * MIN, () => {
      const offer = offerNotDone(user, ["of_card", "of_shop", "of_vod", "of_rpg", "of_lifestyle"]);
      if (offer) grantOffer(ctx, user, offer, atMs - 40 * MIN);
    });
    schedule(atMs, () => void seedDraw(ctx, user, gachaId, 10, atMs, forced));
  }

  // Physical / digital prizes so the shipping workflow (発送管理) has realistic data.
  const prizeWins: Array<[fakeIndex: number, gachaId: string, prizeId: string, hoursAgo: number]> = [
    [1, "g_halloween", "p_halloween_b", 130],
    [2, "g_halloween", "p_halloween_b", 101],
    [6, "g_halloween", "p_halloween_b", 77],
    [27, "g_dream", "p_dream_a", 150],
    [18, "g_dream", "p_dream_b", 70],
    [10, "g_halloween", "p_halloween_b", 49],
    [12, "g_halloween", "p_halloween_a", 46],
    [15, "g_halloween", "p_halloween_b", 26],
    [20, "g_halloween", "p_halloween_b", 20],
    [30, "g_halloween", "p_halloween_b", 13],
    [33, "g_dream", "p_dream_b", 9],
  ];
  for (const [index, gachaId, prizeId, hoursAgo] of prizeWins) {
    const user = fakes[index].user;
    const atMs = now - hoursAgo * HOUR + randInt(rand, 0, 50) * MIN;
    schedule(atMs - 40 * MIN, () => {
      const offer =
        offerNotDone(user, ["of_card", "of_shop", "of_vod", "of_rpg", "of_lifestyle", "of_puzzle", "of_fitness"]) ??
        db.offers.get("of_survey5")!;
      grantOffer(ctx, user, offer, atMs - 40 * MIN);
    });
    schedule(atMs, () => void seedDraw(ctx, user, gachaId, 10, atMs, { [randInt(rand, 0, 9)]: prizeId }));
  }

  // --- Demo user: a believable history --------------------------------------
  const demoCreated = Date.parse(demo.createdAt);
  schedule(demoCreated, () =>
    changeTickets(db, demo, db.rewardSettings.signupBonusTickets, "signup_bonus", "新規登録ボーナス", null, iso(demoCreated)),
  );
  schedule(demoCreated + 1 * DAY, () => grantOffer(ctx, demo, db.offers.get("of_card")!, demoCreated + 1 * DAY));
  schedule(demoCreated + 4 * DAY, () => redeemCoupon(ctx, demo, coupons.poigacha, demoCreated + 4 * DAY));
  schedule(demoCreated + 8 * DAY, () => void seedDraw(ctx, demo, "g_points", 100, demoCreated + 8 * DAY));
  schedule(demoCreated + 9 * DAY, () =>
    changePoints(db, demo, 12_000, "demo_grant", "デモ用ポイント付与", null, iso(demoCreated + 9 * DAY)),
  );
  schedule(demoCreated + 10 * DAY, () => {
    const gift = exchange(ctx, demo, db.exchangeItems.get("ex_gift500")!, demoCreated + 10 * DAY, "shipped", 0);
    if (gift) gift.adminNote = "ギフトコード送付済み";
  });
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    const dayStart = startOfJstDay(now - daysAgo * DAY).getTime();
    const loginAt = dayStart + (8 + (daysAgo % 3)) * HOUR;
    schedule(loginAt, () => grantLoginBonus(ctx, demo, loginAt));
    for (let v = 0; v < (daysAgo % 2 === 0 ? 5 : 3); v++) {
      const at = dayStart + (12 + v) * HOUR;
      schedule(at, () => grantVideoReward(ctx, demo, at));
    }
    if (daysAgo === 4) schedule(dayStart + 20 * HOUR, () => grantOffer(ctx, demo, db.offers.get("of_puzzle")!, dayStart + 20 * HOUR));
    if (daysAgo % 2 === 1) schedule(dayStart + 21 * HOUR, () => void seedDraw(ctx, demo, "g_dream", 10, dayStart + 21 * HOUR));
    if (daysAgo === 2) {
      const at = dayStart + 22 * HOUR + 30 * MIN;
      schedule(at, () => void exchange(ctx, demo, db.exchangeItems.get("ex_tshirt")!, at, "pending", 0));
    }
  }
  // Yesterday's lucky 10-draw: A賞 (physical, ready for a shipping request) + B賞 (digital code).
  const luckyAt = startOfJstDay(now - DAY).getTime() + 22 * HOUR;
  schedule(luckyAt, () => void seedDraw(ctx, demo, "g_dream", 10, luckyAt, { 3: "p_dream_a", 7: "p_dream_b" }));

  events.sort((a, b) => a.at - b.at);
  for (const event of events) event.run();

  // Top up so every feature (100-draws, the 150,000pt exchange) can be tried right away.
  if (demo.tickets < 3000) changeTickets(db, demo, 3000 - demo.tickets, "demo_grant", "デモ用チケット付与", null, iso(now - HOUR));
  if (demo.points < 160_000) changePoints(db, demo, 160_000 - demo.points, "demo_grant", "デモ用ポイント付与", null, iso(now - HOUR));
  demo.lastLoginAt = iso(now - DAY);

  // Sold-out gacha: last-one winner.
  const p1 = fakes[0].user;
  const complete = db.gachas.get("g_complete")!;
  complete.lastOneWinner = { userId: p1.id, nickname: p1.nickname, drawId: "dr_seed_lastone", at: iso(now - 3 * DAY - 4 * HOUR) };
  complete.updatedAt = complete.lastOneWinner.at;
  db.userPrizes.set("up_seed_lastone", {
    id: "up_seed_lastone",
    userId: p1.id,
    gachaId: complete.id,
    gachaTitle: complete.title,
    drawId: "dr_seed_lastone",
    prizeId: null,
    isLastOne: true,
    name: complete.lastOnePrize!.name,
    imageUrl: complete.lastOnePrize!.imageUrl,
    rankName: "ラストワン賞",
    rankColor: "#FFB800",
    type: "physical",
    pointValue: complete.lastOnePrize!.pointValue,
    status: "owned",
    digitalCode: null,
    orderId: null,
    createdAt: complete.lastOneWinner.at,
  });

  // A couple of rejected callbacks so the postback log shows the anti-cheat checks.
  const rejected: Array<[PostbackLog["status"], number, string, VerificationStep[]]> = [
    ["invalid_signature", 401, "署名が一致しないため拒否しました", [
      { key: "signature", label: "署名検証（HMAC-SHA256）", ok: false, detail: "署名が一致しません（改ざん・なりすましの疑い）" },
    ]],
    ["duplicate", 200, "処理済みのトランザクションのため付与しません", [
      { key: "signature", label: "署名検証（HMAC-SHA256）", ok: true, detail: "署名が一致しました" },
      { key: "timestamp", label: "タイムスタンプ検証", ok: true, detail: "受信時刻との差 1秒（許容範囲: 5分）" },
      { key: "duplicate", label: "重複チェック（transaction_id）", ok: false, detail: "同じtransaction_idは処理済みです（二重付与を防止）" },
    ]],
    ["limit_reached", 200, "本日の視聴上限に達しているため付与しません", [
      { key: "signature", label: "署名検証（HMAC-SHA256）", ok: true, detail: "署名が一致しました" },
      { key: "timestamp", label: "タイムスタンプ検証", ok: true, detail: "受信時刻との差 3秒（許容範囲: 5分）" },
      { key: "duplicate", label: "重複チェック（transaction_id）", ok: true, detail: "未処理のトランザクションです" },
      { key: "session", label: "広告セッション照合", ok: true, detail: "視聴セッションを確認" },
      { key: "limit", label: "1日の視聴上限", ok: false, detail: "本日の上限（5回）に達しています" },
    ]],
  ];
  rejected.forEach(([status, httpStatus, message, steps], i) => {
    const user = fakes[5 + i].user;
    const atMs = now - (30 - i * 9) * HOUR;
    const params: Record<string, string> = {
      ad_network: "5450213213286189855",
      ad_unit: "6300978111",
      custom_data: newId("as"),
      reward_amount: "3",
      reward_item: "ticket",
      timestamp: String(atMs),
      transaction_id: `admob-${atMs.toString(36)}-${i}`,
      user_id: user.id,
    };
    params.signature = status === "invalid_signature" ? "0".repeat(64) : signParams("admob", params);
    db.postbacks.push({
      id: newId("pb"),
      kind: "video",
      provider: "admob",
      method: "GET",
      receivedAt: iso(atMs),
      userId: user.id,
      transactionId: params.transaction_id,
      params,
      status,
      httpStatus,
      ticketsGranted: 0,
      steps,
      message,
      source: status === "invalid_signature" ? "external" : "simulator",
    });
  });

  // --- Wrap up --------------------------------------------------------------
  processPrizeBoxes(ctx);
  finalizeDraws(ctx);
  db.ledger.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  db.postbacks.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  db.couponRedemptions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  db.offerCompletions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const audit: Array<[number, string, string, string]> = [
    [now - 10 * DAY, "ガチャを作成", "ハロウィン限定ガチャ", "総口数 30,000口 / 1回 3チケット"],
    [now - 5 * DAY, "付与設定を変更", "リワード動画", "1回あたりの付与枚数 2枚 → 3枚"],
    [now - 5 * DAY + HOUR, "ガチャを作成", "演出確認ガチャ", "デモ用の高確率ガチャ"],
    [now - 3 * DAY, "クーポンを発行", "DM配布用（10月）", "使い捨て型 8件 / 1,000pt"],
    [now - 1 * DAY, "クーポンを発行", "インフルエンサー配布用", "使い捨て型 5件 / 3,000pt"],
    [now - 6 * HOUR, "ランク演出を変更", "特賞", "演出動画を「演出_特賞.mp4」に設定"],
  ];
  for (const [atMs, action, target, detail] of audit) {
    db.auditLogs.push({ id: newId("au"), actorId: ADMIN_USER_ID, actorName: "運営管理者", action, target, detail, createdAt: iso(atMs) });
  }
  return db;
}
