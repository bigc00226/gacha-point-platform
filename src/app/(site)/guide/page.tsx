import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { syncRequestState } from "@/lib/server/state/sync";
import { getDb } from "@/lib/server/store";
import { cn } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon, type IconName } from "@/components/ui/icon";
import { GuideAccounts } from "@/components/guide/guide-login";

export const metadata: Metadata = { title: "デモのご案内・要件対応表" };

const TOC: Array<[id: string, label: string]> = [
  ["accounts", "デモアカウント"],
  ["tour", "3分デモツアー"],
  ["requirements", "要件対応表"],
  ["tech", "技術的なポイント"],
  ["infra", "本番構成のご提案"],
  ["diff", "デモと本番の違い"],
  ["faq", "よくあるご質問"],
];

function Section({ id, title, icon, lead, children }: { id: string; title: string; icon: IconName; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-primary-2 text-white shadow-lg shadow-primary/25">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight text-fg sm:text-2xl">{title}</h2>
          {lead && <p className="mt-1 text-sm leading-relaxed text-muted">{lead}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 font-bold text-primary hover:underline">
      {children}
      <Icon name="arrowUpRight" size={13} />
    </Link>
  );
}

export default async function GuidePage() {
  await syncRequestState();
  const db = getDb();
  const now = nowMs();
  const singleCodes = [...db.coupons.values()]
    .filter((c) => c.type === "single" && c.active && c.usedCount === 0 && (!c.expiresAt || Date.parse(c.expiresAt) > now))
    .slice(0, 3);
  const settings = db.rewardSettings;

  const tour: Array<{ title: string; body: ReactNode; href: string; cta: string }> = [
    {
      title: "一般会員でログイン → ログインボーナスを受け取る",
      body: "ログイン直後にその日のログインボーナス（連続日数つき）が表示されます。ヘッダーにはガチャチケットとポイントが別々に表示されます。",
      href: "/login",
      cta: "ログイン画面",
    },
    {
      title: "動画を見て・案件をこなしてチケットを貯める",
      body: `リワード動画（1回${settings.videoTicketsPerView}枚・1日${settings.videoDailyLimit}回まで）と、オファーウォールの案件を試せます。チケットは広告配信会社からの署名付き成果通知をサーバーで検証してから付与され、その検証過程が画面に表示されます。`,
      href: "/earn",
      cta: "チケットを貯める",
    },
    {
      title: "演出確認ガチャで「1回・10回・100回」を引く",
      body: "特賞はMP4動画、A賞はLottie、B〜D賞は内蔵アニメーションの演出です。10回・100回引きでは「スキップ」で一瞬で結果一覧へ。100回分の抽選は1リクエストで処理され、サーバーの処理時間も表示されます。",
      href: "/gacha/g_demo",
      cta: "演出確認ガチャ",
    },
    {
      title: "ラストワン賞を引き当てる",
      body: "ゴールドラッシュガチャは残りわずか。最後の1口を引いた会員だけに「ラストワン賞」の確定画面が表示されます。画面右端の「DEMO」パネルの「ラストワン直前にする」で何度でも試せます。",
      href: "/gacha/g_goldrush",
      cta: "ゴールドラッシュガチャ",
    },
    {
      title: "マイページでクーポンコードを入力する",
      body: (
        <>
          あいことば <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-fg">WELCOME</code>（先着限定型・500pt）や、下記の使い捨てシリアルコードを入力すると、すぐにポイントが付与されます。
          {singleCodes.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-2">
              {singleCodes.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 py-0.5 pl-2 pr-0.5">
                  <code className="font-mono text-xs text-fg">{c.displayCode}</code>
                  <span className="text-[11px] text-point">{c.points.toLocaleString()}pt</span>
                  <CopyButton text={c.displayCode} label="" copiedLabel="" className="px-1.5" />
                </span>
              ))}
            </span>
          )}
        </>
      ),
      href: "/mypage",
      cta: "マイページ",
    },
    {
      title: "当たった実物景品の発送を依頼する",
      body: "デモユーザーの「獲得景品」にあるワイヤレスイヤホンから、お届け先を入力して発送を依頼できます。発送状況は管理画面と連動します。",
      href: "/mypage?tab=prizes",
      cta: "獲得景品",
    },
    {
      title: "ポイントを景品と交換する",
      body: "デモユーザーは160,000ptを持っています。Nintendo Switch 2（150,000pt）などと交換し、住所入力→完了まで確認できます。",
      href: "/exchange",
      cta: "ポイント交換",
    },
    {
      title: "管理画面で運営操作を試す",
      body: (
        <>
          ガチャの<A href="/admin/gachas/g_demo">景品・確率の変更とシミュレーション</A>、<A href="/admin/media">演出動画のアップロード</A>と
          <A href="/admin/ranks">ランクへの紐付け</A>、<A href="/admin/rewards">付与枚数・視聴上限の変更</A>、<A href="/admin/postbacks">成果通知ログとテスト送信</A>、
          <A href="/admin/orders">発送管理</A>、<A href="/admin/coupons">クーポン発行</A>、<A href="/admin/loadtest">同時アクセスの整合性テスト</A>などを操作できます。
        </>
      ),
      href: "/admin",
      cta: "管理画面（管理者でログイン）",
    },
  ];

  const requirements: Array<{ group: string; req: string; impl: ReactNode; where: Array<[string, string]> }> = [
    { group: "1. ユーザー管理", req: "メールアドレスとパスワードのみの会員登録・ログイン", impl: "パスワードはscryptでハッシュ化、署名付きCookieセッション、ログイン試行回数の制限", where: [["/register", "会員登録"], ["/login", "ログイン"]] },
    { group: "2. ガチャ＆演出", req: "管理画面からガチャを追加・削除、景品名・画像・当選確率（1/100等）を自由に登録・変更", impl: "「1/100」「0.5%」形式で入力、合計100%のチェック、残り確率の自動割当、在庫上限、10万回シミュレーション", where: [["/admin/gachas", "ガチャ管理"]] },
    { group: "2. ガチャ＆演出", req: "1回・10回・100回引き（1アクションでまとめて高速処理）", impl: "1リクエスト＝1トランザクションで最大100回を抽選（暗号論的乱数）。処理時間を結果画面に表示", where: [["/gacha/g_demo", "演出確認ガチャ"]] },
    { group: "2. ガチャ＆演出", req: "当選ランクに応じた演出動画（MP4/Lottie）とスキップ", impl: "最高ランクの演出を再生（MP4・Lottie・内蔵アニメ）、いつでもスキップして100件の結果一覧へ", where: [["/gacha/g_demo", "演出確認ガチャ"]] },
    { group: "2. ガチャ＆演出", req: "素材（動画・サムネイル・ロゴ）を管理画面からアップロードし、景品・ランクに紐付け", impl: "メディアライブラリ（画像/MP4/Lottie）、ランクごとのロゴ・演出設定とプレビュー、景品画像の選択", where: [["/admin/media", "メディア"], ["/admin/ranks", "ランク・演出"]] },
    { group: "3. 総口数＆ラストワン賞", req: "ガチャごとの総口数と「残り〇〇口」の表示（ページ表示時・実行直後のみAPIで取得）", impl: "WebSocket・ポーリングなし。ページ表示時と抽選直後だけ残り口数APIを取得", where: [["/gacha/g_dream", "ドリームガチャ"]] },
    { group: "3. 総口数＆ラストワン賞", req: "最後の1口を引いた会員にラストワン賞の確定画面", impl: "抽選トランザクション内で判定するため当選者は必ず1名。専用の演出と確定画面", where: [["/gacha/g_goldrush", "ゴールドラッシュ"]] },
    { group: "4. ポイ活連携", req: "オファーウォール（skyflag・Tapjoy）の案件達成でチケット付与", impl: "成果通知（Webhook）の署名・時刻・重複・案件照合を検証してから付与。デモでは成果通知を再現", where: [["/earn#offerwall", "案件一覧"], ["/admin/offers", "案件管理"]] },
    { group: "4. ポイ活連携", req: "リワード動画（AdMob）、1日最大5回・毎日0:00リセット・上限でボタンをグレーアウト", impl: "視聴回数はサーバー側で日本時間の日付ごとに管理。上限・付与数は管理画面で変更可能", where: [["/earn#video", "動画を見る"], ["/admin/rewards", "付与設定"]] },
    { group: "4. ポイ活連携", req: "フロントのJSではなく、視聴完了通知をサーバーで検証して付与（チート対策）", impl: "視聴セッション発行→配信会社の署名付き通知を検証→付与。全通知をログ化、不正な通知のテスト送信も可能", where: [["/admin/postbacks", "成果通知ログ"]] },
    { group: "4. ポイ活連携", req: "ポイントとガチャチケットを区別して表示", impl: "ヘッダー・マイページ・各画面でチケット（青）とポイント（金）を明確に区別", where: [["/mypage", "マイページ"]] },
    { group: "5. クーポンコード", req: "使い捨て型（DM配布）と先着限定型（あいことば）を100pt〜任意の額で発行", impl: "一括発行・CSV出力、先着人数で自動終了、おひとり様1回、総当たり対策（入力ミス回数制限）", where: [["/admin/coupons", "クーポン管理"], ["/mypage", "コード入力"]] },
    { group: "6. ポイント交換", req: "景品一覧の追加・編集・在庫数設定、交換申請フォーム、発送先と発送ステータス管理", impl: "在庫・ポイントを排他制御で同時に更新。宛名CSV出力、追跡番号、キャンセル時のポイント返還", where: [["/exchange", "ポイント交換"], ["/admin/orders", "発送管理"]] },
    { group: "7. 拡張性", req: "外部のポイ活ミニゲーム（GMO等）を埋め込める設計", impl: "管理画面からURLを登録するだけで埋め込み枠を追加（iframe・sandbox）。サンプルゲーム付き", where: [["/minigames", "ミニゲーム"], ["/admin/minigames", "ミニゲーム枠"]] },
    { group: "ご回答いただいた内容", req: "ログインボーナス／特賞・大当たりの実物景品（Switch・イヤホン）", impl: "連続ログインに対応したログインボーナス、実物景品の発送依頼フロー（獲得景品→住所入力→発送管理）", where: [["/earn#login-bonus", "ログインボーナス"], ["/mypage?tab=prizes", "獲得景品"]] },
    { group: "非機能要件", req: "アクセス集中時でもラストワン賞の重複などの不整合を防ぐ排他制御", impl: "ガチャ・会員単位のロック＋冪等キー。最大2,000人の同時アクセスを再現する整合性テストを管理画面に搭載", where: [["/admin/loadtest", "負荷・整合性テスト"]] },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm" aria-label="目次">
          <p className="mb-2 text-xs font-bold text-subtle">目次</p>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-14">
        <header className="relative overflow-hidden rounded-3xl border border-line bg-linear-to-br from-[#2a1766] via-surface to-[#3b1240] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <p className="relative inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-black tracking-widest text-accent ring-1 ring-inset ring-accent/40">
            <Icon name="book" size={12} />
            DEMO GUIDE
          </p>
          <h1 className="relative mt-4 font-display text-3xl leading-tight text-fg sm:text-4xl">ポイガチャ デモのご案内</h1>
          <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-fg/85 sm:text-base">
            会員制WEBガチャ（オリパ風）× ポイ活連動型エンタメサイトの初期MVPを想定したデモです。ご提示いただいた要件（ガチャ・演出・ラストワン賞・オファーウォール／動画リワード・クーポン・ポイント交換・管理画面）を、実際に操作できる形で実装しています。
          </p>
          <div className="relative mt-5 flex flex-wrap gap-2">
            <Badge tone="gold">Next.js 16（App Router）</Badge>
            <Badge tone="info">データベースなし（デモ用にサーバーのメモリで動作）</Badge>
            <Badge tone="success">スマホ・PC対応</Badge>
          </div>
        </header>

        <Section id="accounts" title="デモアカウント" icon="key" lead="ワンクリックでログインできます。画面右端の「DEMO」タブからも、アカウント切り替えやチケットの追加ができます。">
          <GuideAccounts />
        </Section>

        <Section id="tour" title="3分デモツアー" icon="rocket" lead="以下の順に操作いただくと、主な機能をひと通りご確認いただけます。">
          <ol className="space-y-3">
            {tour.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary to-primary-2 font-display text-base text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-fg">{step.title}</p>
                  <div className="mt-1 text-sm leading-relaxed text-muted">{step.body}</div>
                  <Link href={step.href} className="mt-2.5 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                    {step.cta}を開く
                    <Icon name="arrowRight" size={15} />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="requirements" title="要件対応表" icon="clipboard" lead="ご依頼内容とデモでの実装の対応です。リンクから該当画面をご確認いただけます。">
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="hidden grid-cols-[10rem_1fr_1fr_9rem] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-bold text-muted md:grid">
              <span>区分</span>
              <span>ご要件</span>
              <span>デモでの実装</span>
              <span>確認する画面</span>
            </div>
            <ul className="divide-y divide-line bg-surface">
              {requirements.map((r) => (
                <li key={r.req} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[10rem_1fr_1fr_9rem] md:gap-4">
                  <span className="flex items-start gap-1.5 text-xs font-bold text-subtle">
                    <Icon name="checkCircle" size={15} className="shrink-0 text-success" />
                    {r.group}
                  </span>
                  <span className="font-bold text-fg">{r.req}</span>
                  <span className="text-muted">{r.impl}</span>
                  <span className="flex flex-wrap content-start items-start gap-x-3 gap-y-1.5 text-xs">
                    {r.where.map(([href, label]) => (
                      <A key={href} href={href}>
                        {label}
                      </A>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="tech" title="技術的なポイント" icon="shieldCheck" lead="運営を続けるうえで重要な「正確さ」と「不正対策」を、MVPの段階から組み込んでいます。">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["dice", "公正な抽選", "抽選はすべてサーバー側で確定し、暗号論的に安全な乱数（CSPRNG）を使用。確率は10億分の1単位の整数で管理し、端数による誤差がありません。"],
                ["zap", "100回引きを1リクエストで", "100回分の抽選・チケット消費・ポイント付与・景品登録を1トランザクションで処理。ブラウザからのリクエストは1回だけです。"],
                ["lock", "排他制御と二重送信対策", "ガチャ・会員単位のロックで残り口数とチケット残高を一貫して更新。同じリクエストIDの再送は保存済みの結果を返すため、通信エラー時も二重課金しません。"],
                ["crown", "ラストワン賞は必ず1名", "残り口数が0になる更新を行った抽選だけが当選者を記録。同時アクセスでも重複しないことを負荷テストで確認できます。"],
                ["shield", "広告・案件の不正対策", "チケットは広告配信会社・オファーウォールからの成果通知を、署名（HMAC）・時刻・取引IDの重複・視聴セッション・1日の上限で検証してから付与します。"],
                ["history", "すべての増減を記録", "チケット・ポイントの付与と消費はすべて台帳（履歴）に記録。会員の履歴、成果通知ログ、管理者の操作ログからいつでも追跡できます。"],
                ["calendar", "0:00の自動リセット", "動画の視聴回数やログインボーナスは日本時間の日付で管理。バッチ処理なしで毎日0:00に自動的にリセットされます。"],
                ["video", "演出ファイルの配信", "アップロードした動画はHTTP Rangeに対応した配信（iPhoneのSafariでも再生可能）。本番ではCDNから配信して表示を高速化します。"],
              ] as Array<[IconName, string, string]>
            ).map(([icon, title, body]) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-4">
                <p className="flex items-center gap-2 font-black text-fg">
                  <Icon name={icon} size={17} className="text-primary" />
                  {title}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="infra" title="本番構成のご提案" icon="server" lead="最大同時接続 1,000〜2,000人を想定した、費用対効果の高い構成案です。">
          <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
            <div className="grid items-stretch gap-3 text-center text-xs md:grid-cols-[1fr_auto_1.2fr_auto_1.4fr]">
              <div className="rounded-2xl border border-line bg-surface-2 p-3">
                <Icon name="smartphone" size={22} className="mx-auto text-primary" />
                <p className="mt-1 font-bold text-fg">会員（スマホ・PC）</p>
                <p className="mt-1 text-muted">ブラウザ</p>
              </div>
              <Icon name="arrowRight" size={20} className="mx-auto rotate-90 self-center text-subtle md:rotate-0" />
              <div className="rounded-2xl border border-info/40 bg-info/8 p-3">
                <Icon name="cloud" size={22} className="mx-auto text-info" />
                <p className="mt-1 font-bold text-fg">Cloudflare（CDN / WAF）</p>
                <p className="mt-1 text-muted">画像・演出動画のキャッシュ配信、Bot対策、DDoS防御</p>
              </div>
              <Icon name="arrowRight" size={20} className="mx-auto rotate-90 self-center text-subtle md:rotate-0" />
              <div className="space-y-2">
                <div className="rounded-2xl border border-primary/40 bg-primary/8 p-3">
                  <Icon name="layers" size={22} className="mx-auto text-primary" />
                  <p className="mt-1 font-bold text-fg">Next.js アプリ（2台〜・オートスケール）</p>
                  <p className="mt-1 text-muted">画面・API・抽選処理・Webhook受信</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-success/40 bg-success/8 p-2">
                    <Icon name="database" size={18} className="mx-auto text-success" />
                    <p className="mt-1 font-bold text-fg">PostgreSQL</p>
                  </div>
                  <div className="rounded-xl border border-danger/40 bg-danger/8 p-2">
                    <Icon name="zap" size={18} className="mx-auto text-danger" />
                    <p className="mt-1 font-bold text-fg">Redis</p>
                  </div>
                  <div className="rounded-xl border border-warning/40 bg-warning/8 p-2">
                    <Icon name="archive" size={18} className="mx-auto text-warning" />
                    <p className="mt-1 font-bold text-fg">S3 / R2</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-3 text-xs text-muted">
              <Icon name="signal" size={15} className="text-accent" />
              Google AdMob / skyflag / Tapjoy → 成果通知（Webhook）→ Next.js アプリで署名検証 → チケット付与
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {(
              [
                {
                  name: "プランA（推奨）",
                  tone: "border-primary/50 bg-primary/5",
                  stack: "Render または AWS（ECS Fargate）で Next.js ×2台＋ マネージドPostgreSQL ＋ Redis ＋ Cloudflare R2/CDN",
                  cost: "月額 約1.5万〜2.5万円",
                  note: "サーバー管理が不要で、アクセス増に合わせて台数を増やせます。バックアップも自動。",
                },
                {
                  name: "プランB（最小構成）",
                  tone: "border-line",
                  stack: "国内VPS（4GB）1台に Next.js・PostgreSQL・Nginx ＋ Cloudflare（無料プラン）",
                  cost: "月額 約3,000〜6,000円",
                  note: "費用は最小ですが、OS更新・バックアップ・障害対応などの運用負荷が高くなります。",
                },
                {
                  name: "プランC（イベント・成長期）",
                  tone: "border-line",
                  stack: "プランA ＋ オートスケール（2→4台以上）・DBリードレプリカ・抽選処理のキュー化",
                  cost: "月額 約3万〜6万円",
                  note: "大型キャンペーンやテレビ露出など、瞬間的なアクセス集中に備える構成です。",
                },
              ] as const
            ).map((plan) => (
              <div key={plan.name} className={cn("rounded-2xl border p-4", plan.tone)}>
                <p className="font-black text-fg">{plan.name}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{plan.stack}</p>
                <p className="mt-3 font-display text-lg text-accent">{plan.cost}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{plan.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">
            ※ 費用は各社の公開料金をもとにした目安です（構成・アクセス量・為替により変動します）。正式なお見積りは要件確定後にご提示します。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["同時1,000〜2,000人への対応", "アプリはセッション情報をCookieに持つステートレス構成のため台数を増やすだけで処理能力を拡張でき、画像・演出動画はCDNから配信してサーバーの負荷を抑えます。"],
                ["データの整合性", "残り口数・チケット残高・在庫は SELECT … FOR UPDATE と条件付きUPDATEで1トランザクション内に更新。抽選リクエストIDと成果通知の取引IDにはユニーク制約を設定します。"],
                ["DB接続の最適化", "PgBouncer等のコネクションプーリングで、同時アクセス時もDB接続数を一定に保ちます。抽選1回あたりのDB処理は数ミリ秒です。"],
                ["不正アクセス対策", "会員登録にCloudflare Turnstile（Bot対策）、APIに会員・IP単位のレート制限、Webhookは署名検証＋配信会社のIP制限を併用します。"],
              ] as const
            ).map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-bold text-fg">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="diff" title="デモと本番の違い" icon="layers" lead="デモはご確認いただきやすいよう、一部の外部連携をシミュレーションしています。">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line text-sm">
              {(
                [
                  ["データの保存", "サーバーのメモリ（Vercel では全インスタンスで共有。再デプロイ・初期化で元に戻ります）", "PostgreSQL（自動バックアップ）"],
                  ["動画リワード・オファーウォール", "配信会社の成果通知を画面上で再現", "AdMob・skyflag・Tapjoyの実際のSDK／成果通知と接続"],
                  ["デジタル特典・ギフトコード", "ダミーのコードを表示", "ギフト発行サービスとAPI連携、または運営が発行したコードを配布"],
                  ["メディアのアップロード", "1ファイル数MBまで（サーバーに直接保存）", "S3/R2へ直接アップロードし、大容量の演出動画もCDNで配信"],
                  ["メール", "送信なし", "会員登録確認・パスワード再設定・発送通知などを送信"],
                  ["デモ用ツール", "DEMOパネル・データ初期化あり", "本番では無効化（環境変数で切り替え）"],
                ] as const
              ).map(([item, demo, prod]) => (
                <li key={item} className="grid gap-1 px-4 py-3 md:grid-cols-[12rem_1fr_1fr] md:gap-4">
                  <span className="font-bold text-fg">{item}</span>
                  <span className="text-muted">
                    <Badge tone="neutral" size="xs" className="mr-1.5">デモ</Badge>
                    {demo}
                  </span>
                  <span className="text-fg/90">
                    <Badge tone="success" size="xs" className="mr-1.5">本番</Badge>
                    {prod}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="faq" title="よくあるご質問" icon="help">
          <div className="space-y-2">
            {(
              [
                ["演出動画はどのように差し替えますか？", "管理画面の「メディアライブラリ」で動画（MP4）またはLottie（JSON）をアップロードし、「ランク・演出設定」で特賞〜D賞・ラストワン賞に紐付けるだけで反映されます。読み込みに失敗した場合は内蔵アニメーションに自動で切り替わります。"],
                ["確率の設定を間違えた場合は？", "合計が100%を超える・「残り確率」の景品がないなどの誤りは保存時にエラーになります。保存前に10万回のシミュレーションで実際の出現率を確認できます。"],
                ["100回引きでサーバーに負荷はかかりませんか？", "100回分を1回のリクエスト・1回のトランザクションで処理するため、1回引きを100回行うよりも大幅に軽量です。デモでも処理時間（数ミリ秒程度）を結果画面に表示しています。"],
                ["動画の視聴上限はいつリセットされますか？", "日本時間の毎日0:00です。バッチ処理ではなく、日付が変わった最初のアクセスで自動的に0回として扱います。上限回数は管理画面からいつでも変更できます。"],
                ["AdMob・Tapjoy はWEBサイトでも利用できますか？", "AdMob・Tapjoy は主にスマホアプリ向けのサービスです。WEBサイトでは Google Ad Manager のウェブ向けリワード広告など、ブラウザに対応した広告・オファーウォールを利用します。サーバーへの成果通知（S2S）の仕様は配信会社ごとに異なるため、要件定義の段階で確認し、本デモと同じ「サーバーで検証してから付与」する方式で接続します。"],
                ["データはどこに保存されていますか？", "このデモはデータベースを使用せず、サーバーのメモリ上に保存しています（Vercel で公開した場合は、Vercel 標準のキャッシュ機能で全サーバーに同じデータを共有します）。再起動・再デプロイや「デモデータを初期化」で初期状態に戻ります。本番ではPostgreSQLに保存します。"],
              ] as const
            ).map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-bold text-fg [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <span className="text-primary">Q.</span>
                    {q}
                  </span>
                  <Icon name="chevronDown" size={16} className="shrink-0 text-subtle transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-line px-4 py-3.5 text-sm leading-relaxed text-muted">
                  <span className="mr-1 font-bold text-accent">A.</span>
                  {a}
                </p>
              </details>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
