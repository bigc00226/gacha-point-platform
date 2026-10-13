"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PublicUser } from "@/lib/types";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"form" | "user" | "admin" | null>(null);

  async function login(credentials: { email: string; password: string }, source: "form" | "user" | "admin") {
    setPending(source);
    setError(null);
    try {
      const { user } = await api.post<{ user: PublicUser }>("/api/auth/login", credentials);
      toast.success(`ようこそ、${user.nickname}さん`);
      const target = user.role === "admin" && source === "admin" && next === "/" ? "/admin" : next;
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void login({ email, password }, "form");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="メールアドレス" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="パスワード" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-fg"
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" fullWidth loading={pending === "form"} disabled={pending !== null}>
          ログイン
        </Button>
        <p className="text-center text-sm text-muted">
          はじめての方は{" "}
          <Link href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary hover:underline">
            無料会員登録
          </Link>
        </p>
      </form>

      <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-accent">
          <Icon name="flask" size={16} />
          デモ用アカウントでログイン
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          ワンクリックでログインできます（一般会員: {DEMO_ACCOUNTS.user.email} / {DEMO_ACCOUNTS.user.password}）。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon="user"
            loading={pending === "user"}
            disabled={pending !== null}
            onClick={() => login(DEMO_ACCOUNTS.user, "user")}
          >
            一般会員
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="shield"
            loading={pending === "admin"}
            disabled={pending !== null}
            onClick={() => login(DEMO_ACCOUNTS.admin, "admin")}
          >
            管理者
          </Button>
        </div>
      </div>
    </div>
  );
}
