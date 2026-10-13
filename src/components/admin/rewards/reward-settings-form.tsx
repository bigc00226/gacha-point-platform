"use client";

import { useState } from "react";
import type { OfferCategory } from "@/lib/types";
import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice, StatCard } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { RewardSettingsInput, RewardSettingsPageDto, RewardSettingsSaveDto } from "./types";

type FormState = {
  videoTicketsPerView: string;
  videoDailyLimit: string;
  loginBonusTickets: string;
  signupBonusTickets: string;
  offerMultiplier: string;
  offerCategoryTickets: Record<OfferCategory, string>;
};

function toForm(s: RewardSettingsPageDto["settings"]): FormState {
  return {
    videoTicketsPerView: String(s.videoTicketsPerView),
    videoDailyLimit: String(s.videoDailyLimit),
    loginBonusTickets: String(s.loginBonusTickets),
    signupBonusTickets: String(s.signupBonusTickets),
    offerMultiplier: String(s.offerMultiplier),
    offerCategoryTickets: Object.fromEntries(OFFER_CATEGORIES.map((c) => [c, String(s.offerCategoryTickets[c])])) as Record<OfferCategory, string>,
  };
}

function toInput(f: FormState): RewardSettingsInput {
  return {
    videoTicketsPerView: Number(f.videoTicketsPerView),
    videoDailyLimit: Number(f.videoDailyLimit),
    loginBonusTickets: Number(f.loginBonusTickets),
    signupBonusTickets: Number(f.signupBonusTickets),
    offerMultiplier: Number(f.offerMultiplier),
    offerCategoryTickets: Object.fromEntries(OFFER_CATEGORIES.map((c) => [c, Number(f.offerCategoryTickets[c])])) as Record<OfferCategory, number>,
  };
}

function UnitInput({
  id,
  value,
  onChange,
  unit,
  step,
  min,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  step?: string;
  min?: number;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        min={min ?? 0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-12 tabular"
        invalid={invalid}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
    </div>
  );
}

export function RewardSettingsForm({ initial }: { initial: RewardSettingsPageDto }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial.settings);
  const [form, setForm] = useState<FormState>(() => toForm(initial.settings));
  const [history, setHistory] = useState(initial.history);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null);

  const dirty = JSON.stringify(toInput(form)) !== JSON.stringify(toInput(toForm(saved)));
  const multiplier = Number(form.offerMultiplier) || 0;
  const set = (key: Exclude<keyof FormState, "offerCategoryTickets">) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const errorFor = (field: string) => (error?.field === field ? error.message : null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<RewardSettingsSaveDto>("/api/admin/rewards/settings", toInput(form));
      setSaved(res.settings);
      setForm(toForm(res.settings));
      setHistory(res.history);
      if (res.changed) toast.success("付与設定を保存しました", res.changes.join(" / "));
      else toast.info("変更はありません");
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setError({ field, message: errorMessage(err) });
      toast.error("保存できませんでした", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const stats = initial.today;

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="本日のログインボーナス" value={`${formatNumber(stats.login.tickets)}枚`} sub={`${formatNumber(stats.login.count)}件`} icon="calendar" tone="primary" />
        <StatCard label="本日の動画視聴" value={`${formatNumber(stats.video.tickets)}枚`} sub={`${formatNumber(stats.video.count)}件`} icon="tv" tone="ticket" />
        <StatCard label="本日の案件達成" value={`${formatNumber(stats.offer.tickets)}枚`} sub={`${formatNumber(stats.offer.count)}件`} icon="smartphone" tone="info" />
        <StatCard label="本日の新規登録ボーナス" value={`${formatNumber(stats.signup.tickets)}枚`} sub={`${formatNumber(stats.signup.count)}件`} icon="users" tone="success" />
      </div>

      {error && !error.field && <Notice tone="danger">{error.message}</Notice>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon="tv" title="リワード動画（Google AdMob）" description="視聴完了通知をサーバーで検証したときに付与されます。" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="1回あたりの付与枚数" htmlFor="video-tickets" error={errorFor("videoTicketsPerView")} hint="例: 3枚">
              <UnitInput id="video-tickets" value={form.videoTicketsPerView} onChange={set("videoTicketsPerView")} unit="枚" min={1} invalid={!!errorFor("videoTicketsPerView")} />
            </Field>
            <Field label="1日の視聴上限" htmlFor="video-limit" error={errorFor("videoDailyLimit")} hint="毎日 AM0:00（日本時間）にリセット">
              <UnitInput id="video-limit" value={form.videoDailyLimit} onChange={set("videoDailyLimit")} unit="回" min={1} invalid={!!errorFor("videoDailyLimit")} />
            </Field>
            <div className="sm:col-span-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
              1日の最大獲得:
              <span className="ml-1 font-black text-ticket">
                {formatNumber((Number(form.videoTicketsPerView) || 0) * (Number(form.videoDailyLimit) || 0))}枚
              </span>
              （{form.videoTicketsPerView || 0}枚 × {form.videoDailyLimit || 0}回）
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon="calendar" title="ログインボーナス・新規登録" description="会員が毎日受け取れるボーナスと、登録時のプレゼントです。" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="ログインボーナス（1日1回）" htmlFor="login-tickets" error={errorFor("loginBonusTickets")}>
              <UnitInput id="login-tickets" value={form.loginBonusTickets} onChange={set("loginBonusTickets")} unit="枚" invalid={!!errorFor("loginBonusTickets")} />
            </Field>
            <Field label="新規登録ボーナス" htmlFor="signup-tickets" error={errorFor("signupBonusTickets")}>
              <UnitInput id="signup-tickets" value={form.signupBonusTickets} onChange={set("signupBonusTickets")} unit="枚" invalid={!!errorFor("signupBonusTickets")} />
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon="smartphone"
          title="案件達成（skyflag / Tapjoy）"
          description="カテゴリごとの付与枚数 × 倍率（キャンペーン時に一括で増やせます）で付与数が決まります。"
        />
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="付与倍率" htmlFor="multiplier" error={errorFor("offerMultiplier")} hint="1.0〜10.0（0.1刻み）" className="sm:w-48">
              <UnitInput id="multiplier" value={form.offerMultiplier} onChange={set("offerMultiplier")} unit="倍" step="0.1" min={1} invalid={!!errorFor("offerMultiplier")} />
            </Field>
            <div className="flex flex-wrap gap-2 pb-6">
              {[1, 1.5, 2, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("offerMultiplier")(String(m))}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-sm font-bold transition-colors",
                    multiplier === m ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:bg-surface-2",
                  )}
                >
                  ×{m}
                  {m === 1 ? "（通常）" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OFFER_CATEGORIES.map((c) => {
              const base = Number(form.offerCategoryTickets[c]) || 0;
              const fieldKey = `offerCategoryTickets.${c}`;
              return (
                <div key={c} className="rounded-xl border border-line p-3.5">
                  <Field label={OFFER_CATEGORY_LABELS[c]} htmlFor={`cat-${c}`} error={errorFor(fieldKey)}>
                    <UnitInput
                      id={`cat-${c}`}
                      value={form.offerCategoryTickets[c]}
                      onChange={(v) => setForm((f) => ({ ...f, offerCategoryTickets: { ...f.offerCategoryTickets, [c]: v } }))}
                      unit="枚"
                      invalid={!!errorFor(fieldKey)}
                    />
                  </Field>
                  <p className="mt-2 text-xs text-muted">
                    会員への付与: <span className="font-black text-ticket">{formatNumber(Math.round(base * multiplier))}枚</span>
                    {multiplier !== 1 && <span className="ml-1">（{formatNumber(base)} × {multiplier}）</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon="history" title="変更履歴" description="付与設定の変更は操作ログに記録されます。" />
        {history.length === 0 ? (
          <EmptyState icon="history" title="変更履歴はまだありません" className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="tabular shrink-0 text-xs text-muted sm:w-36">{formatDateTime(h.createdAt)}</span>
                <span className="shrink-0 text-xs font-bold text-fg sm:w-24">{h.actorName}</span>
                <span className="min-w-0 text-sm text-fg">
                  <span className="mr-1.5 font-bold">{h.target}</span>
                  <span className="text-muted">{h.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className={cn("text-sm", dirty ? "font-bold text-warning" : "text-muted")}>
            {dirty ? (
              <>
                <Icon name="alert" size={14} className="mr-1 inline" />
                未保存の変更があります（保存すると次の付与からすぐ反映されます）
              </>
            ) : (
              `最終更新: ${formatDateTime(saved.updatedAt)}${saved.updatedBy ? `（${saved.updatedBy}）` : ""}`
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => setForm(toForm(saved))}>
              元に戻す
            </Button>
            <Button leftIcon="check" onClick={save} loading={saving} disabled={!dirty}>
              保存する
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
