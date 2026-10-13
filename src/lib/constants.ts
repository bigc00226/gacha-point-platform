/** Labels and fixed lists shared across the app. */
import type {
  BuiltinEffectStyle,
  EffectType,
  GachaStatus,
  LedgerReason,
  MediaKind,
  OfferCategory,
  OfferProvider,
  OrderSource,
  OrderStatus,
  PostbackStatus,
  PrizeType,
  UserPrizeStatus,
} from "@/lib/types";

export const SITE_NAME = "ポイガチャ";
export const SITE_NAME_EN = "POIGACHA";

/** Buttons shown on the gacha page. */
export const DRAW_COUNTS = [1, 10, 100] as const;
export const MAX_DRAW_COUNT = 100;

/** Demo accounts (also shown on the login page and the guide). */
export const DEMO_ACCOUNTS = {
  user: { email: "user@demo.jp", password: "demo1234", label: "一般会員" },
  admin: { email: "admin@demo.jp", password: "admin1234", label: "管理者" },
} as const;

export const GACHA_STATUS_LABELS: Record<GachaStatus, string> = {
  draft: "下書き",
  active: "公開中",
  paused: "一時停止",
  soldout: "完売",
};

export const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  point: "ポイント",
  digital: "デジタル特典",
  physical: "実物景品",
};

export const USER_PRIZE_STATUS_LABELS: Record<UserPrizeStatus, string> = {
  owned: "未申請",
  shipping_requested: "発送準備中",
  shipped: "発送済",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "未発送",
  shipped: "発送済",
  cancelled: "キャンセル",
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  exchange: "ポイント交換",
  gacha_prize: "ガチャ景品",
};

export const LEDGER_REASON_LABELS: Record<LedgerReason, string> = {
  signup_bonus: "新規登録ボーナス",
  login_bonus: "ログインボーナス",
  video_reward: "動画視聴",
  offer_reward: "案件達成",
  gacha_draw: "ガチャ",
  gacha_prize: "ガチャ当選",
  lastone_prize: "ラストワン賞",
  coupon: "クーポンコード",
  exchange: "ポイント交換",
  exchange_refund: "交換キャンセル返還",
  admin_adjust: "運営調整",
  demo_grant: "デモ用付与",
};

export const OFFER_CATEGORY_LABELS: Record<OfferCategory, string> = {
  app: "アプリ導入",
  game: "ゲーム",
  survey: "アンケート",
  signup: "無料会員登録",
  shopping: "ショッピング",
  card: "カード発行",
};

export const OFFER_CATEGORIES: OfferCategory[] = ["app", "game", "survey", "signup", "shopping", "card"];

export const OFFER_PROVIDER_LABELS: Record<OfferProvider, string> = {
  skyflag: "skyflag",
  tapjoy: "Tapjoy",
};

export const POSTBACK_PROVIDER_LABELS: Record<string, string> = {
  admob: "Google AdMob（リワード動画）",
  skyflag: "skyflag（オファーウォール）",
  tapjoy: "Tapjoy（オファーウォール）",
};

export const POSTBACK_STATUS_LABELS: Record<PostbackStatus, string> = {
  granted: "付与済",
  duplicate: "重複（付与なし）",
  invalid_signature: "署名不正",
  expired: "期限切れ",
  limit_reached: "上限到達",
  unknown_user: "ユーザー不明",
  invalid_session: "セッション不正",
  invalid_request: "リクエスト不正",
};

export const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  builtin: "内蔵アニメーション",
  video: "動画（MP4）",
  lottie: "Lottie（JSON）",
};

export const BUILTIN_EFFECT_LABELS: Record<BuiltinEffectStyle, string> = {
  rainbow: "レインボー（最上位）",
  gold: "ゴールド",
  red: "レッド",
  purple: "パープル",
  blue: "ブルー",
  basic: "ベーシック",
  lastone: "ラストワン",
};

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "画像",
  video: "動画",
  lottie: "Lottie",
};

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;
