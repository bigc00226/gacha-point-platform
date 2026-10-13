"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GachaStatus, LastOnePrize, PrizeType } from "@/lib/types";
import type { GachaEditDto, PrizeEditDto, SimulationDto } from "@/lib/server/services/admin-gacha";
import type { RankAdminDto } from "@/lib/server/services/ranks";
import { GACHA_STATUS_LABELS, PRIZE_TYPE_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { describeProbability, parseProbability, ppbToPercent, PPB } from "@/lib/probability";
import { formatDateTime } from "@/lib/time";
import { Badge, RankBadge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { MediaPicker } from "@/components/admin/media-picker";
import { EffectPreviewModal, type EffectPreviewTarget } from "@/components/admin/ranks/effect-preview";

type PrizeRow = PrizeEditDto & { key: string };

interface FormState {
  title: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  ticketCost: string;
  totalSlots: string;
  remainingSlots: string;
  status: GachaStatus;
  badge: string;
  featured: boolean;
  sortOrder: string;
  endsAt: string;
  hasLastOne: boolean;
  lastOnePrize: LastOnePrize;
  prizes: PrizeRow[];
}

const EMPTY_LAST_ONE: LastOnePrize = { name: "", description: "", imageUrl: null, type: "physical", pointValue: 0 };

/** ISO → value for <input type="datetime-local"> in Japan time. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(0, 16);
}
function localInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+09:00`).toISOString();
}

function toForm(g: GachaEditDto): FormState {
  return {
    title: g.title,
    subtitle: g.subtitle,
    description: g.description,
    thumbnailUrl: g.thumbnailUrl,
    ticketCost: String(g.ticketCost),
    totalSlots: String(g.totalSlots),
    remainingSlots: String(g.remainingSlots),
    status: g.status === "soldout" ? "active" : g.status,
    badge: g.badge ?? "",
    featured: g.featured,
    sortOrder: String(g.sortOrder),
    endsAt: isoToLocalInput(g.endsAt),
    hasLastOne: !!g.lastOnePrize,
    lastOnePrize: g.lastOnePrize ?? EMPTY_LAST_ONE,
    prizes: g.prizes.map((p, i) => ({ ...p, key: p.id ?? `new-${i}` })),
  };
}

function toBody(f: FormState) {
  return {
    title: f.title,
    subtitle: f.subtitle,
    description: f.description,
    thumbnailUrl: f.thumbnailUrl,
    ticketCost: Number(f.ticketCost),
    totalSlots: Number(f.totalSlots),
    remainingSlots: Number(f.remainingSlots),
    status: f.status,
    badge: f.badge,
    featured: f.featured,
    sortOrder: Number(f.sortOrder),
    endsAt: localInputToIso(f.endsAt),
    lastOnePrize: f.hasLastOne ? f.lastOnePrize : null,
    prizes: f.prizes.map((p) => ({
      id: p.id,
      rankId: p.rankId,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      type: p.type,
      pointValue: p.pointValue,
      probabilityInput: p.probabilityInput,
      isFallback: p.isFallback,
      stock: p.stock,
    })),
  };
}

function Section({ id, title, description, icon, children, actions }: { id: string; title: string; description?: string; icon: Parameters<typeof CardHeader>[0]["icon"]; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader icon={icon} title={title} description={description} actions={actions} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export function GachaEditor({ gacha, ranks }: { gacha: GachaEditDto; ranks: RankAdminDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = gacha.id === null;
  const [saved, setSaved] = useState(gacha);
  const [form, setForm] = useState<FormState>(() => toForm(gacha));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [simCount, setSimCount] = useState(100_000);
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<SimulationDto | null>(null);
  const [preview, setPreview] = useState<EffectPreviewTarget | null>(null);

  const prizeRankOptions = ranks.filter((r) => !r.isLastOne);
  const rankById = useMemo(() => new Map(ranks.map((r) => [r.id, r])), [ranks]);
  const baseline = useMemo(() => JSON.stringify(toBody(toForm(saved))), [saved]);
  const dirty = JSON.stringify(toBody(form)) !== baseline;

  // Live probability summary.
  const parsed = form.prizes.map((p) => (p.isFallback ? null : parseProbability(p.probabilityInput)));
  const assigned = parsed.reduce((sum, r) => sum + (r && r.ok ? r.ppb : 0), 0);
  const remainder = PPB - assigned;
  const fallbackCount = form.prizes.filter((p) => p.isFallback).length;
  const ppbOf = (i: number) => (form.prizes[i].isFallback ? Math.max(0, remainder) : parsed[i]?.ok ? (parsed[i] as { ppb: number }).ppb : 0);
  const expectedPoints = form.prizes.reduce((sum, p, i) => (p.type === "point" ? sum + (ppbOf(i) / PPB) * p.pointValue : sum), 0);
  const problems: string[] = [];
  if (fallbackCount !== 1) problems.push("「残り確率」を割り当てる景品を1つだけ選んでください");
  if (assigned > PPB) problems.push(`確率の合計が100%を超えています（${ppbToPercent(assigned, 4)}）`);
  if (parsed.some((r) => r && !r.ok)) problems.push("確率の入力に誤りがある景品があります");
  const total = Number(form.totalSlots) || 0;
  const remaining = Number(form.remainingSlots) || 0;
  const sold = Math.max(0, saved.totalSlots - saved.remainingSlots);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setPrize = (index: number, patch: Partial<PrizeRow>) =>
    setForm((f) => ({ ...f, prizes: f.prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  const errorFor = (field: string) => (error?.field === field ? error.message : null);

  function setFallback(index: number) {
    setForm((f) => ({
      ...f,
      prizes: f.prizes.map((p, i) => (i === index ? { ...p, isFallback: true, stock: null } : { ...p, isFallback: false })),
    }));
  }

  function addPrize() {
    const lowest = prizeRankOptions[prizeRankOptions.length - 1];
    setForm((f) => ({
      ...f,
      prizes: [
        ...f.prizes,
        {
          key: crypto.randomUUID(),
          id: null,
          rankId: lowest?.id ?? "",
          name: "",
          description: "",
          imageUrl: null,
          type: "point",
          pointValue: 100,
          probabilityInput: "1/100",
          isFallback: false,
          stock: null,
          wonCount: 0,
        },
      ],
    }));
  }

  function movePrize(index: number, dir: -1 | 1) {
    setForm((f) => {
      const prizes = [...f.prizes];
      const j = index + dir;
      if (j < 0 || j >= prizes.length) return f;
      [prizes[index], prizes[j]] = [prizes[j], prizes[index]];
      return { ...f, prizes };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const res = await api.post<{ id: string }>("/api/admin/gachas", toBody(form));
        toast.success("ガチャを作成しました", form.status === "draft" ? "下書きとして保存しました" : undefined);
        router.push(`/admin/gachas/${res.id}`);
        return;
      }
      const res = await api.put<{ gacha: GachaEditDto }>(`/api/admin/gachas/${gacha.id}`, toBody(form));
      setSaved(res.gacha);
      setForm(toForm(res.gacha));
      toast.success("保存しました", "ユーザー画面にすぐ反映されます");
      router.refresh();
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setError({ field, message: errorMessage(err) });
      toast.error("保存できませんでした", errorMessage(err));
      if (field) document.getElementById(field.startsWith("prizes") ? "prizes" : field.startsWith("lastOnePrize") ? "lastone" : "basic")?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!gacha.id) return;
    setDeleting(true);
    try {
      await api.del(`/api/admin/gachas/${gacha.id}`);
      toast.success("ガチャを削除しました");
      router.push("/admin/gachas");
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function simulate() {
    setSimulating(true);
    setSimulation(null);
    try {
      setSimulation(
        await api.post<SimulationDto>("/api/admin/gachas/simulate", { gachaId: gacha.id, prizes: toBody(form).prizes, count: simCount }),
      );
    } catch (err) {
      toast.error("シミュレーションできませんでした", errorMessage(err));
    } finally {
      setSimulating(false);
    }
  }

  const usedRanks = [...new Set(form.prizes.map((p) => p.rankId))].map((id) => rankById.get(id)).filter(Boolean) as RankAdminDto[];
  const lastOneRank = ranks.find((r) => r.isLastOne);

  return (
    <div className="pb-24">
      {error && !error.field && <Notice tone="danger" className="mb-4">{error.message}</Notice>}
      {!isNew && saved.lastOneWinner && (
        <Notice tone="warning" className="mb-4" title="このガチャは完売しています">
          ラストワン賞は {saved.lastOneWinner.nickname}さんが獲得しました（{formatDateTime(saved.lastOneWinner.at)}）。残り口数を増やして保存すると販売を再開できます。
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Section id="basic" icon="capsule" title="基本情報" description="ユーザー画面のガチャ一覧・詳細ページに表示されます。">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ガチャ名" htmlFor="g-title" required error={errorFor("title")}>
                <Input id="g-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="例: ドリームガチャ" invalid={!!errorFor("title")} />
              </Field>
              <Field label="キャッチコピー" htmlFor="g-sub" error={errorFor("subtitle")}>
                <Input id="g-sub" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="例: Switch 2を狙え！" />
              </Field>
              <Field label="説明文" htmlFor="g-desc" error={errorFor("description")} className="md:col-span-2">
                <Textarea id="g-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <MediaPicker label="サムネイル画像（16:9推奨）" value={form.thumbnailUrl} onChange={(url) => set("thumbnailUrl", url)} kinds={["image"]} aspect="16/9" />
              </div>
              <Field label="バッジ（任意）" htmlFor="g-badge" hint="例: PICK UP / 期間限定 / NEW" error={errorFor("badge")}>
                <Input id="g-badge" value={form.badge} onChange={(e) => set("badge", e.target.value)} maxLength={20} />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox checked={form.featured} onChange={(e) => set("featured", e.target.checked)} label="注目ガチャとして表示する" description="トップページの「注目」に表示されます" />
              </div>
            </div>
          </Section>

          <Section id="sales" icon="ticket" title="販売設定" description="1回あたりのチケット消費数・総口数・公開状態を設定します。">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="1回あたりのチケット" htmlFor="g-cost" required error={errorFor("ticketCost")}>
                <Input id="g-cost" type="number" min={1} value={form.ticketCost} onChange={(e) => set("ticketCost", e.target.value)} invalid={!!errorFor("ticketCost")} />
              </Field>
              <Field label="総口数" htmlFor="g-total" required error={errorFor("totalSlots")} hint="例: 300,000口">
                <Input id="g-total" type="number" min={1} value={form.totalSlots} onChange={(e) => set("totalSlots", e.target.value)} invalid={!!errorFor("totalSlots")} />
              </Field>
              <Field
                label="残り口数"
                htmlFor="g-remaining"
                required
                error={errorFor("remainingSlots")}
                hint={isNew ? "通常は総口数と同じ" : `販売済み ${formatNumber(sold)}口`}
              >
                <Input id="g-remaining" type="number" min={0} max={total} value={form.remainingSlots} onChange={(e) => set("remainingSlots", e.target.value)} invalid={!!errorFor("remainingSlots")} />
              </Field>
              {!isNew && remaining !== saved.remainingSlots && (
                <Notice tone="warning" className="md:col-span-3">
                  残り口数を手動で変更しようとしています（{formatNumber(saved.remainingSlots)} → {formatNumber(remaining)}）。{remaining === 0 ? "0にすると完売扱いになります。" : "販売中の口数は抽選処理と排他制御されているため、保存時点の値で上書きされます。"}
                </Notice>
              )}
              <Field label="公開状態" htmlFor="g-status" error={errorFor("status")}>
                <Select id="g-status" value={form.status} onChange={(e) => set("status", e.target.value as GachaStatus)}>
                  {(["draft", "active", "paused"] as GachaStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {GACHA_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="販売終了日時（任意）" htmlFor="g-ends" error={errorFor("endsAt")} hint="日本時間。空欄なら「なくなり次第終了」">
                <Input id="g-ends" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
              <Field label="表示順" htmlFor="g-sort" error={errorFor("sortOrder")} hint="小さいほど上に表示">
                <Input id="g-sort" type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section
            id="prizes"
            icon="gift"
            title="景品設定"
            description="景品名・画像・ランク・当選確率（「1/100」「0.5%」などで入力）を自由に登録・変更できます。在庫を設定した景品は在庫がなくなると「残り確率」の景品に振り替えられます。"
            actions={
              <Button size="sm" leftIcon="plus" onClick={addPrize} disabled={form.prizes.length >= 30}>
                景品を追加
              </Button>
            }
          >
            {error?.field === "prizes" && <Notice tone="danger" className="mb-3">{error.message}</Notice>}
            <ol className="space-y-3">
              {form.prizes.map((p, i) => {
                const rank = rankById.get(p.rankId);
                const r = parsed[i];
                const f = (name: string) => errorFor(`prizes.${i}.${name}`);
                return (
                  <li
                    key={p.key}
                    className={cn("rounded-xl border bg-surface p-3", f("probabilityInput") || f("name") || f("stock") || f("pointValue") ? "border-danger" : "border-line")}
                    style={{ borderLeftWidth: 4, borderLeftColor: rank?.color ?? "var(--line)" }}
                  >
                    <div className="flex gap-3">
                      <MediaPicker compact value={p.imageUrl} onChange={(url) => setPrize(i, { imageUrl: url })} kinds={["image"]} label="景品画像" />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-12">
                        <div className="sm:col-span-3">
                          <Select value={p.rankId} onChange={(e) => setPrize(i, { rankId: e.target.value })} aria-label="ランク" invalid={!!f("rankId")}>
                            {prizeRankOptions.map((rk) => (
                              <option key={rk.id} value={rk.id}>
                                {rk.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="sm:col-span-6">
                          <Input value={p.name} onChange={(e) => setPrize(i, { name: e.target.value })} placeholder="景品名（例: Nintendo Switch 2）" aria-label="景品名" invalid={!!f("name")} />
                        </div>
                        <div className="sm:col-span-3">
                          <Select value={p.type} onChange={(e) => setPrize(i, { type: e.target.value as PrizeType })} aria-label="景品の種類">
                            {(Object.keys(PRIZE_TYPE_LABELS) as PrizeType[]).map((t) => (
                              <option key={t} value={t}>
                                {PRIZE_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="sm:col-span-5">
                          {p.isFallback ? (
                            <div className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-success/50 bg-success/5 px-3 text-sm">
                              <Icon name="percent" size={15} className="text-success" />
                              <span className="font-bold text-success">残り確率</span>
                              <span className="tabular text-muted">{remainder >= 0 ? `${ppbToPercent(remainder, 4)}` : "—"}</span>
                            </div>
                          ) : (
                            <Input
                              value={p.probabilityInput}
                              onChange={(e) => setPrize(i, { probabilityInput: e.target.value })}
                              placeholder="確率 例: 1/100 / 0.5%"
                              aria-label="当選確率"
                              className="font-mono"
                              invalid={!!(r && !r.ok) || !!f("probabilityInput")}
                            />
                          )}
                        </div>
                        <div className="sm:col-span-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              value={p.type === "point" ? p.pointValue : p.pointValue || ""}
                              onChange={(e) => setPrize(i, { pointValue: Number(e.target.value) })}
                              aria-label={p.type === "point" ? "付与ポイント" : "参考価格（pt）"}
                              placeholder={p.type === "point" ? "付与pt" : "参考pt"}
                              className="pr-9 tabular"
                              invalid={!!f("pointValue")}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">pt</span>
                          </div>
                        </div>
                        <div className="sm:col-span-4">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              value={p.stock ?? ""}
                              onChange={(e) => setPrize(i, { stock: e.target.value === "" ? null : Number(e.target.value) })}
                              placeholder="在庫無制限"
                              aria-label="在庫"
                              disabled={p.isFallback}
                              className="pr-20 tabular"
                              invalid={!!f("stock")}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">当選 {formatNumber(p.wonCount)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:col-span-12">
                          <span className={cn("tabular font-bold", p.isFallback ? "text-success" : r && r.ok ? "text-fg" : "text-danger")}>
                            {p.isFallback
                              ? `当選確率 ${remainder >= 0 ? ppbToPercent(remainder, 4) : "—"}（残り確率）`
                              : r && r.ok
                                ? `当選確率 ${describeProbability(r.ppb)}`
                                : r && !r.ok
                                  ? r.error
                                  : ""}
                          </span>
                          <label className="flex cursor-pointer items-center gap-1.5 font-bold text-muted">
                            <input type="radio" name="fallback" checked={p.isFallback} onChange={() => setFallback(i)} className="size-4 accent-(--success)" />
                            残り確率を割り当てる（はずれなし枠）
                          </label>
                          {(f("probabilityInput") || f("name") || f("stock") || f("pointValue") || f("rankId")) && (
                            <span className="font-bold text-danger">{f("probabilityInput") || f("name") || f("stock") || f("pointValue") || f("rankId")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <IconButton icon="chevronUp" label="上へ" size="xs" onClick={() => movePrize(i, -1)} disabled={i === 0} />
                        <IconButton icon="chevronDown" label="下へ" size="xs" onClick={() => movePrize(i, 1)} disabled={i === form.prizes.length - 1} />
                        <IconButton
                          icon="trash"
                          label="削除"
                          size="xs"
                          onClick={() => setForm((fm) => ({ ...fm, prizes: fm.prizes.filter((_, j) => j !== i) }))}
                          disabled={form.prizes.length <= 1}
                          className="hover:text-danger"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section
            id="lastone"
            icon="crown"
            title="ラストワン賞"
            description="最後の1口を引いた会員に、通常の景品とは別に贈呈されます（排他制御により当選者は必ず1名）。"
            actions={<Checkbox checked={form.hasLastOne} onChange={(e) => set("hasLastOne", e.target.checked)} label="設定する" />}
          >
            {form.hasLastOne ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="名称" htmlFor="lo-name" required error={errorFor("lastOnePrize.name")}>
                  <Input id="lo-name" value={form.lastOnePrize.name} onChange={(e) => set("lastOnePrize", { ...form.lastOnePrize, name: e.target.value })} placeholder="例: Nintendo Switch 2" invalid={!!errorFor("lastOnePrize.name")} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="種類" htmlFor="lo-type">
                    <Select id="lo-type" value={form.lastOnePrize.type} onChange={(e) => set("lastOnePrize", { ...form.lastOnePrize, type: e.target.value as PrizeType })}>
                      {(Object.keys(PRIZE_TYPE_LABELS) as PrizeType[]).map((t) => (
                        <option key={t} value={t}>
                          {PRIZE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={form.lastOnePrize.type === "point" ? "付与ポイント" : "参考価格"} htmlFor="lo-pt" error={errorFor("lastOnePrize.pointValue")}>
                    <Input id="lo-pt" type="number" min={0} value={form.lastOnePrize.pointValue} onChange={(e) => set("lastOnePrize", { ...form.lastOnePrize, pointValue: Number(e.target.value) })} invalid={!!errorFor("lastOnePrize.pointValue")} />
                  </Field>
                </div>
                <Field label="説明" htmlFor="lo-desc" className="md:col-span-2">
                  <Input id="lo-desc" value={form.lastOnePrize.description} onChange={(e) => set("lastOnePrize", { ...form.lastOnePrize, description: e.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <MediaPicker label="画像" value={form.lastOnePrize.imageUrl} onChange={(url) => set("lastOnePrize", { ...form.lastOnePrize, imageUrl: url })} kinds={["image"]} aspect="1/1" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">ラストワン賞は設定されていません。</p>
            )}
          </Section>

          <Section
            id="simulation"
            icon="dice"
            title="確率シミュレーション"
            description="現在の設定（未保存の内容を含む）で、サーバーの抽選ロジック（暗号論的乱数）を使って大量に抽選し、実際の出現率を確認できます。データは変更されません。"
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field label="抽選回数" htmlFor="sim-count" className="w-48">
                <Select id="sim-count" value={simCount} onChange={(e) => setSimCount(Number(e.target.value))}>
                  <option value={10_000}>1万回</option>
                  <option value={100_000}>10万回</option>
                  <option value={1_000_000}>100万回</option>
                </Select>
              </Field>
              <Button leftIcon="play" variant="secondary" onClick={simulate} loading={simulating} disabled={problems.length > 0}>
                シミュレーションを実行
              </Button>
              {simulation && <span className="pb-2.5 text-xs text-muted">{formatNumber(simulation.count)}回を {simulation.ms}ms で抽選</span>}
            </div>
            {simulation && (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                <Table>
                  <THead>
                    <tr>
                      <TH>景品</TH>
                      <TH className="text-right">設定確率</TH>
                      <TH className="text-right">当選回数</TH>
                      <TH className="text-right">実測</TH>
                      <TH className="w-40">比較</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {simulation.rows.map((row) => {
                      const observedRate = row.observed / simulation.count;
                      const expectedRate = row.configuredPpb / PPB;
                      const max = Math.max(observedRate, expectedRate, 1e-9);
                      return (
                        <TR key={row.key}>
                          <TD>
                            <div className="flex items-center gap-2">
                              <RankBadge name={row.rankName} color={row.rankColor} size="xs" />
                              <span className="max-w-48 truncate">{row.name}</span>
                              {row.stockLeft !== null && <Badge size="xs" tone="warning">在庫{formatNumber(row.stockLeft)}</Badge>}
                            </div>
                          </TD>
                          <TD className="tabular text-right">{ppbToPercent(row.configuredPpb, 4)}</TD>
                          <TD className="tabular text-right">{formatNumber(row.observed)}</TD>
                          <TD className="tabular text-right font-bold">{(observedRate * 100).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}%</TD>
                          <TD>
                            <div className="space-y-1">
                              <div className="h-1.5 rounded-full bg-surface-3">
                                <div className="h-full rounded-full bg-subtle" style={{ width: `${(expectedRate / max) * 100}%` }} />
                              </div>
                              <div className="h-1.5 rounded-full bg-surface-3">
                                <div className="h-full rounded-full" style={{ width: `${(observedRate / max) * 100}%`, background: row.rankColor }} />
                              </div>
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
                <p className="border-t border-line px-4 py-2 text-[11px] text-muted">上段: 設定確率 / 下段: 実測。在庫が設定された景品は在庫数を超えて当選しないため、在庫切れ後は「残り確率」の景品に振り替わります。</p>
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Card>
            <CardHeader icon="percent" title="確率のサマリー" />
            <CardBody className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                {form.prizes.map((p, i) => {
                  const w = (ppbOf(i) / PPB) * 100;
                  return w > 0 ? <div key={p.key} style={{ width: `${w}%`, background: rankById.get(p.rankId)?.color ?? "#999" }} title={p.name} /> : null;
                })}
              </div>
              <ul className="space-y-1.5 text-xs">
                {form.prizes.map((p, i) => (
                  <li key={p.key} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: rankById.get(p.rankId)?.color ?? "#999" }} />
                    <span className="min-w-0 flex-1 truncate">{p.name || "（名称未設定）"}</span>
                    <span className="tabular shrink-0 text-muted">{ppbToPercent(ppbOf(i), 4)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">設定済みの合計</span>
                  <span className={cn("tabular font-bold", assigned > PPB && "text-danger")}>{ppbToPercent(assigned, 4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">残り確率（自動）</span>
                  <span className="tabular font-bold text-success">{remainder >= 0 ? ppbToPercent(remainder, 4) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">1回あたりの期待ポイント</span>
                  <span className="tabular font-bold text-point">{expectedPoints.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}pt</span>
                </div>
              </div>
              {problems.length > 0 ? (
                <Notice tone="danger">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {problems.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Notice>
              ) : (
                <Notice tone="success">確率の設定は有効です</Notice>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon="sparkles" title="演出プレビュー" description="ランクごとの演出はランク・演出設定で変更できます。" />
            <CardBody className="flex flex-wrap gap-2">
              {usedRanks.map((r) => (
                <Button key={r.id} size="sm" variant="secondary" leftIcon="play" onClick={() => setPreview({ name: r.name, color: r.color, logoUrl: r.logoUrl, effect: r.effect })}>
                  {r.name}
                </Button>
              ))}
              {form.hasLastOne && lastOneRank && (
                <Button size="sm" variant="secondary" leftIcon="crown" onClick={() => setPreview({ name: lastOneRank.name, color: lastOneRank.color, logoUrl: lastOneRank.logoUrl, effect: lastOneRank.effect })}>
                  {lastOneRank.name}
                </Button>
              )}
              <Link href="/admin/ranks" className="mt-1 w-full text-xs font-bold text-primary hover:underline">
                ランク・演出設定を開く →
              </Link>
            </CardBody>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                <ButtonLink href={`/gacha/${gacha.id}`} target="_blank" variant="ghost" size="sm" leftIcon="external">
                  ユーザー画面で見る
                </ButtonLink>
                <Button variant="ghost" size="sm" leftIcon="trash" className="text-danger" onClick={() => setConfirmDelete(true)}>
                  削除
                </Button>
              </>
            )}
            <span className={cn("hidden text-sm sm:inline", dirty ? "font-bold text-warning" : "text-muted")}>{dirty ? "未保存の変更があります" : "保存済み"}</span>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/admin/gachas" variant="secondary">
              一覧に戻る
            </ButtonLink>
            <Button leftIcon="check" onClick={save} loading={saving} disabled={!isNew && !dirty}>
              {isNew ? "作成する" : "保存する"}
            </Button>
          </div>
        </div>
      </div>

      <EffectPreviewModal target={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        title="このガチャを削除しますか？"
        description="景品設定も削除されます。会員の抽選履歴・獲得景品・ポイント履歴は保持されます。"
        confirmLabel="削除する"
      />
    </div>
  );
}
