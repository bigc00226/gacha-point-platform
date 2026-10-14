import Link from "next/link";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="cv-auto mt-12 border-t border-line bg-bg-2/60 pb-24 [--cv-size:420px] md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-display text-lg text-fg">ポイガチャ</span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted">
            動画視聴・アンケート・アプリ導入でガチャチケットを貯めて、オリパ風WEBガチャに挑戦できる会員制エンタメサイト（デモ版）です。
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-subtle">サービス</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-muted hover:text-fg" href="/">ガチャ一覧</Link></li>
            <li><Link className="text-muted hover:text-fg" href="/earn">チケットを貯める</Link></li>
            <li><Link className="text-muted hover:text-fg" href="/exchange">ポイント交換</Link></li>
            <li><Link className="text-muted hover:text-fg" href="/minigames">ミニゲーム</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold text-subtle">デモについて</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-muted hover:text-fg" href="/guide">デモガイド・要件対応表</Link></li>
            <li><Link className="text-muted hover:text-fg" href="/admin">管理画面（デモ）</Link></li>
            <li><Link className="text-muted hover:text-fg" href="/mypage">マイページ</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/60">
        <p className="mx-auto max-w-6xl px-4 py-4 text-[11px] text-subtle sm:px-6">
          © 2026 POIGACHA demo. 本サイトは提案用のデモです。表示される会員・案件・取引データはすべてダミーです。
        </p>
      </div>
    </footer>
  );
}
