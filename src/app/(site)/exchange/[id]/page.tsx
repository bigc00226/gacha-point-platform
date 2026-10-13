import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { getExchangeItem } from "@/lib/server/services/exchange";
import { ExchangeFlow } from "@/components/exchange/exchange-flow";

export const metadata: Metadata = { title: "ポイント交換" };

export default async function ExchangeItemPage({ params }: PageProps<"/exchange/[id]">) {
  const { id } = await params;
  const item = getExchangeItem(id);
  if (!item) notFound();
  const user = await getCurrentUser();
  return <ExchangeFlow item={item} viewer={user ? { points: user.points, lastAddress: user.lastAddress } : null} />;
}
