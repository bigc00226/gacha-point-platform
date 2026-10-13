import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/url";
import { getCurrentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/store";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "無料会員登録" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);
  return (
    <AuthCard title="無料会員登録" subtitle="メールアドレスだけで、すぐに始められます">
      <RegisterForm next={nextPath} signupBonus={getDb().rewardSettings.signupBonusTickets} />
    </AuthCard>
  );
}
