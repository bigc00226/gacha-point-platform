import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Body text uses the device's own Japanese font (see --font-sans in globals.css).
// A Japanese web font is split into ~120 files; every one that arrives makes the
// browser lay the page out again, which froze phones for 1–2 s after load.
// Only the display face (headings) is a web font.
const delaGothic = Dela_Gothic_One({
  variable: "--font-dela-gothic",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Every page reads live in-memory data (balances, remaining slots ...), so
// nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "ポイガチャ｜ポイ活×オリパ風WEBガチャ【デモ】",
    template: "%s｜ポイガチャ DEMO",
  },
  description:
    "動画視聴・アンケート・アプリ導入でガチャチケットを貯めて、オリパ風WEBガチャに挑戦できる会員制エンタメサイトのデモです。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0820",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className={delaGothic.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
