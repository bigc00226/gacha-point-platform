import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/server/auth";
import { buildEarnPageData } from "@/lib/server/services/rewards";
import { SectionTitle } from "@/components/ui/misc";
import { EarnHero, RecentRewards, SecurityExplainer } from "@/components/earn/earn-sections";
import { LoginBonusCard } from "@/components/earn/login-bonus-card";
import { Offerwall } from "@/components/earn/offerwall";
import { VideoRewardCard } from "@/components/earn/video-reward-card";

export const metadata: Metadata = { title: "チケットを貯める" };

export default async function EarnPage() {
  const user = await getCurrentUser();
  const data = buildEarnPageData(user);
  const viewer = data.viewer;

  return (
    <div className="space-y-8 sm:space-y-10">
      <EarnHero data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="login-bonus" className="scroll-mt-24">
          <LoginBonusCard
            status={viewer?.loginBonus ?? null}
            tickets={data.settings.loginBonusTickets}
            serverNow={data.serverNow}
            className="h-full"
          />
        </section>
        <section id="video" className="scroll-mt-24">
          <VideoRewardCard
            video={viewer?.video ?? null}
            ticketsPerView={data.settings.videoTicketsPerView}
            dailyLimit={data.settings.videoDailyLimit}
            serverNow={data.serverNow}
            className="h-full"
          />
        </section>
      </div>

      <section id="offerwall" className="scroll-mt-24" aria-labelledby="offerwall-heading">
        <SectionTitle
          title="案件に挑戦してチケットGET"
          subtitle="アプリ導入・アンケート・会員登録など（skyflag / Tapjoy）"
          icon="smartphone"
        />
        <Offerwall offers={data.offers} loggedIn={!!viewer} multiplier={data.settings.offerMultiplier} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SecurityExplainer />
        {viewer && <RecentRewards items={viewer.recent} serverNow={Date.parse(data.serverNow)} />}
      </div>
    </div>
  );
}
