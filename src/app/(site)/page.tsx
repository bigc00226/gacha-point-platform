import { getCurrentUser } from "@/lib/server/auth";
import { listGachaCards, recentBigWins } from "@/lib/server/services/gacha";
import { getDb, lastOneRank } from "@/lib/server/store";
import { nowMs } from "@/lib/time";
import { SectionTitle } from "@/components/ui/misc";
import { BannerCarousel, type BannerItem } from "@/components/home/banner-carousel";
import { EarnStrip } from "@/components/home/earn-strip";
import { GachaGrid } from "@/components/home/gacha-grid";
import { HowToPlay } from "@/components/home/how-to-play";
import { LastOneSpotlight } from "@/components/home/lastone-spotlight";
import { RegisterCta } from "@/components/home/register-cta";
import { WinsTicker } from "@/components/home/wins-ticker";

const BANNERS: BannerItem[] = [
  { src: "/demo/banner/lastone.jpg", href: "/gacha/g_goldrush", alt: "ラストワン賞でSwitch 2をGET！" },
  { src: "/demo/banner/earn.jpg", href: "/earn", alt: "動画・アンケートでガチャチケットが貯まる" },
  { src: "/demo/banner/halloween.jpg", href: "/gacha/g_halloween", alt: "ハロウィン限定ガチャ開催中" },
  { src: "/demo/banner/coupon.jpg", href: "/mypage", alt: "公式Xのあいことばでポイントプレゼント" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const db = getDb();
  const now = nowMs();
  const gachas = listGachaCards();
  const wins = recentBigWins(12);
  const settings = db.rewardSettings;
  const spotlight = gachas.find((g) => g.nearLastOne && g.available && g.lastOnePrize) ?? null;
  const maxOfferTickets = Math.round(Math.max(...Object.values(settings.offerCategoryTickets)) * settings.offerMultiplier);

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="space-y-3">
        <BannerCarousel items={BANNERS} />
        <WinsTicker wins={wins} now={now} />
      </div>

      {!user && <RegisterCta bonus={settings.signupBonusTickets} />}

      {spotlight && <LastOneSpotlight gacha={spotlight} rankLogoUrl={lastOneRank(db)?.logoUrl ?? null} />}

      <section aria-labelledby="gacha-list">
        <SectionTitle title="ガチャ一覧" subtitle="チケットを使って、好きなガチャに挑戦しよう" icon="capsule" />
        <GachaGrid gachas={gachas} serverNow={now} />
      </section>

      <EarnStrip
        loginBonusTickets={settings.loginBonusTickets}
        videoTicketsPerView={settings.videoTicketsPerView}
        videoDailyLimit={settings.videoDailyLimit}
        maxOfferTickets={maxOfferTickets}
        multiplier={settings.offerMultiplier}
      />

      <HowToPlay />
    </div>
  );
}
