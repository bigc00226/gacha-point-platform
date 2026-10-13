import Link from "next/link";

export default function NotFound() {
  return (
    <div className="theme-site site-backdrop grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl text-gradient-primary">404</p>
        <h1 className="mt-4 text-xl font-black text-fg">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-muted">お探しのページは削除されたか、URLが間違っている可能性があります。</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-linear-to-r from-primary to-primary-2 px-6 text-sm font-bold text-white"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
