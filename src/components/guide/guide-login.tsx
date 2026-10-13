"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

/** Demo account cards with one-click login. */
export function GuideAccounts() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<"user" | "admin" | null>(null);

  async function login(kind: "user" | "admin") {
    setPending(kind);
    try {
      await api.post("/api/auth/login", { email: DEMO_ACCOUNTS[kind].email, password: DEMO_ACCOUNTS[kind].password });
      toast.success(`${DEMO_ACCOUNTS[kind].label}でログインしました`);
      router.push(kind === "admin" ? "/admin" : "/");
      router.refresh();
    } catch (err) {
      toast.error("ログインできませんでした", errorMessage(err));
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["user", "admin"] as const).map((kind) => {
        const a = DEMO_ACCOUNTS[kind];
        return (
          <div key={kind} className="rounded-2xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-black text-fg">
              <Icon name={kind === "admin" ? "shield" : "user"} size={16} className={kind === "admin" ? "text-accent" : "text-primary"} />
              {a.label}アカウント
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted">メール</dt>
                <dd className="min-w-0 flex-1 truncate font-mono">{a.email}</dd>
                <CopyButton text={a.email} label="" copiedLabel="" className="px-1.5" />
              </div>
              <div className="flex items-center gap-2">
                <dt className="w-24 shrink-0 text-xs text-muted">パスワード</dt>
                <dd className="min-w-0 flex-1 truncate font-mono">{a.password}</dd>
                <CopyButton text={a.password} label="" copiedLabel="" className="px-1.5" />
              </div>
            </dl>
            <Button className="mt-4" fullWidth variant={kind === "admin" ? "gold" : "primary"} leftIcon="login" loading={pending === kind} disabled={pending !== null} onClick={() => login(kind)}>
              {kind === "admin" ? "管理者でログインして管理画面へ" : "一般会員でログイン"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
