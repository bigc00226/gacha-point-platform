import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/url";
import { getCurrentUser } from "@/lib/server/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);
  return (
    <AuthCard title="ログイン" subtitle="メールアドレスとパスワードでログイン">
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
