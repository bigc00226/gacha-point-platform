"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PublicUser } from "@/lib/types";
import { ApiClientError, api, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

type FieldName = "nickname" | "email" | "password" | "agree";

export function RegisterForm({ next, signupBonus }: { next: string; signupBonus: number }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ nickname: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: FieldName | null; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const errorFor = (field: FieldName) => (fieldError?.field === field ? fieldError.message : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFieldError(null);
    try {
      const res = await api.post<{ user: PublicUser; signupBonus: number }>("/api/auth/register", { ...values, agree });
      toast.success(
        "会員登録が完了しました！",
        res.signupBonus > 0 ? `登録ボーナスとしてガチャチケット${res.signupBonus}枚をプレゼントしました。` : undefined,
      );
      router.push(next);
      router.refresh();
    } catch (err) {
      const field =
        err instanceof ApiClientError && typeof (err.details as { field?: unknown })?.field === "string"
          ? ((err.details as { field: FieldName }).field ?? null)
          : null;
      setFieldError({ field, message: errorMessage(err) });
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {signupBonus > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-ticket/30 bg-ticket/8 px-4 py-3">
          <Icon name="gift" size={22} className="shrink-0 text-ticket" />
          <p className="text-sm text-fg">
            今なら登録だけで <span className="font-black text-ticket">ガチャチケット{signupBonus}枚</span> をプレゼント！
          </p>
        </div>
      )}
      {fieldError && !fieldError.field && <Notice tone="danger">{fieldError.message}</Notice>}
      <Field label="ニックネーム" htmlFor="nickname" required error={errorFor("nickname")} hint="ランキングや当選者一覧に表示されます（20文字以内）">
        <Input id="nickname" autoComplete="nickname" maxLength={20} value={values.nickname} onChange={set("nickname")} invalid={!!errorFor("nickname")} />
      </Field>
      <Field label="メールアドレス" htmlFor="email" required error={errorFor("email")}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={values.email} onChange={set("email")} invalid={!!errorFor("email")} />
      </Field>
      <Field label="パスワード" htmlFor="password" required error={errorFor("password")} hint="英字と数字を組み合わせて8文字以上">
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            className="pr-11"
            invalid={!!errorFor("password")}
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
      <Field error={errorFor("agree")}>
        <Checkbox
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label="利用規約・プライバシーポリシーに同意する"
          description="デモ環境のため規約ページは省略しています。"
        />
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        無料で登録する
      </Button>
      <p className="text-center text-sm text-muted">
        すでに会員の方は{" "}
        <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-primary hover:underline">
          ログイン
        </Link>
      </p>
    </form>
  );
}
