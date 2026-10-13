import type { Metadata } from "next";
import { requireUser } from "@/lib/server/auth";
import { buildMypageData } from "@/lib/server/services/mypage";
import { MypageView } from "@/components/mypage/mypage-view";
import { MYPAGE_TABS, type MypageTab } from "@/components/mypage/tabs";

export const metadata: Metadata = { title: "マイページ" };

export default async function MypagePage({ searchParams }: PageProps<"/mypage">) {
  const { tab } = await searchParams;
  const user = await requireUser(`/mypage${typeof tab === "string" ? `?tab=${tab}` : ""}`);
  const initialTab = (MYPAGE_TABS as string[]).includes(String(tab)) ? (tab as MypageTab) : "overview";
  // key: re-mount when the tab in the URL changes via a link (e.g. from the draw overlay).
  return <MypageView key={initialTab} data={buildMypageData(user)} initialTab={initialTab} />;
}
