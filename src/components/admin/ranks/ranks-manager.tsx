"use client";

import { useState } from "react";
import type { BuiltinEffectStyle, EffectType, Rank } from "@/lib/types";
import { BUILTIN_EFFECT_LABELS, EFFECT_TYPE_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/format";
import { Badge, RankBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MediaPicker } from "@/components/admin/media-picker";
import { EffectPreviewModal, type EffectPreviewTarget } from "./effect-preview";

interface RankAdminDto extends Rank {
  prizeCount: number;
}

interface RankForm {
  name: string;
  subtitle: string;
  color: string;
  logoUrl: string | null;
  effect: { type: EffectType; url: string | null; builtinStyle: BuiltinEffectStyle };
}

const TYPE_OPTIONS: Array<{ type: EffectType; icon: IconName; title: string; note: string }> = [
  { type: "builtin", icon: "sparkles", title: "内蔵アニメーション", note: "ファイル不要。ランクに合わせた演出" },
  { type: "video", icon: "video", title: "動画（MP4）", note: "制作した演出動画を再生" },
  { type: "lottie", icon: "layers", title: "Lottie（JSON）", note: "軽量なベクターアニメーション" },
];

function toForm(r: RankAdminDto | null): RankForm {
  return r
    ? { name: r.name, subtitle: r.subtitle, color: r.color, logoUrl: r.logoUrl, effect: { ...r.effect } }
    : { name: "", subtitle: "", color: "#6B93FF", logoUrl: null, effect: { type: "builtin", url: null, builtinStyle: "blue" } };
}

export function RanksManager({ initial }: { initial: RankAdminDto[] }) {
  const toast = useToast();
  const [ranks, setRanks] = useState(initial);
  const [editing, setEditing] = useState<{ rank: RankAdminDto | null; form: RankForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null);
  const [preview, setPreview] = useState<EffectPreviewTarget | null>(null);
  const [deleting, setDeleting] = useState<RankAdminDto | null>(null);
  const [busy, setBusy] = useState(false);

  const prizeRanks = ranks.filter((r) => !r.isLastOne);

  function patch(next: Partial<RankForm>) {
    setEditing((e) => (e ? { ...e, form: { ...e.form, ...next } } : e));
  }
  function patchEffect(next: Partial<RankForm["effect"]>) {
    setEditing((e) => (e ? { ...e, form: { ...e.form, effect: { ...e.form.effect, ...next } } } : e));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = editing.rank
        ? await api.put<{ ranks: RankAdminDto[] }>(`/api/admin/ranks/${editing.rank.id}`, editing.form)
        : await api.post<{ ranks: RankAdminDto[] }>("/api/admin/ranks", editing.form);
      setRanks(res.ranks);
      toast.success(editing.rank ? "ランクを更新しました" : "ランクを追加しました", editing.form.name);
      setEditing(null);
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setError({ field, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = prizeRanks.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    try {
      const res = await api.post<{ ranks: RankAdminDto[] }>("/api/admin/ranks/reorder", { ids });
      setRanks(res.ranks);
    } catch (err) {
      toast.error("並び替えできませんでした", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await api.del<{ ranks: RankAdminDto[] }>(`/api/admin/ranks/${deleting.id}`);
      setRanks(res.ranks);
      toast.success("ランクを削除しました");
      setDeleting(null);
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (f: string) => (error?.field === f ? error.message : null);
  const form = editing?.form;

  return (
    <div className="space-y-4">
      <Notice tone="info" title="演出が再生されるルール">
        1回のガチャで当選した景品のうち<strong>もっとも高いランク</strong>の演出が再生されます（10回・100回引きでも演出は1回）。最後の1口を引いた場合は、続けて「ラストワン賞」の演出が再生されます。動画・Lottieの読み込みに失敗した場合は、内蔵アニメーションが自動で再生されます。
      </Notice>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm text-muted">上にあるほど高いランクです（ラストワン賞は特別枠）</p>
          <Button size="sm" leftIcon="plus" onClick={() => {
            setError(null);
            setEditing({ rank: null, form: toForm(null) });
          }}>
            ランクを追加
          </Button>
        </div>
        <ul className="divide-y divide-line">
          {ranks.map((r) => {
            const index = prizeRanks.findIndex((x) => x.id === r.id);
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                <div className="flex items-center gap-3 md:w-80">
                  <div className="flex w-8 flex-col items-center">
                    {r.isLastOne ? (
                      <Icon name="crown" size={18} className="text-accent" filled />
                    ) : (
                      <>
                        <button type="button" className="text-subtle hover:text-fg disabled:opacity-30" onClick={() => move(r.id, -1)} disabled={busy || index === 0} aria-label="上へ">
                          <Icon name="chevronUp" size={16} />
                        </button>
                        <span className="tabular text-xs font-bold text-muted">{r.order}</span>
                        <button type="button" className="text-subtle hover:text-fg disabled:opacity-30" onClick={() => move(r.id, 1)} disabled={busy || index === prizeRanks.length - 1} aria-label="下へ">
                          <Icon name="chevronDown" size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="grid h-14 w-36 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0b0a1a] p-1.5">
                    {r.logoUrl ? (
                      <img src={r.logoUrl} alt={r.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="font-display text-xl" style={{ color: r.color }}>
                        {r.name}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <RankBadge name={r.name} color={r.color} />
                      <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: r.color }} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{r.subtitle || "—"}</p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                  <Badge tone={r.effect.type === "builtin" ? "neutral" : r.effect.type === "video" ? "primary" : "gold"} icon={r.effect.type === "video" ? "video" : r.effect.type === "lottie" ? "layers" : "sparkles"}>
                    {EFFECT_TYPE_LABELS[r.effect.type]}
                  </Badge>
                  <span className="min-w-0 truncate text-muted">
                    {r.effect.type === "builtin" ? BUILTIN_EFFECT_LABELS[r.effect.builtinStyle] : r.effect.url?.split("/").pop()}
                  </span>
                  {!r.isLastOne && <span className="text-xs text-subtle">景品 {r.prizeCount}件</span>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" leftIcon="play" onClick={() => setPreview({ name: r.name, color: r.color, logoUrl: r.logoUrl, effect: r.effect })}>
                    演出プレビュー
                  </Button>
                  <IconButton icon="edit" label="編集" size="sm" onClick={() => {
                    setError(null);
                    setEditing({ rank: r, form: toForm(r) });
                  }} />
                  {!r.isLastOne && (
                    <IconButton icon="trash" label="削除" size="sm" onClick={() => setDeleting(r)} className="hover:text-danger" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.rank ? `ランクを編集：${editing.rank.name}` : "ランクを追加"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" leftIcon="play" onClick={() => form && setPreview({ name: form.name || "プレビュー", color: form.color, logoUrl: form.logoUrl, effect: form.effect })} disabled={saving}>
              この設定でプレビュー
            </Button>
            <Button onClick={save} loading={saving} leftIcon="check">
              保存する
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            {error && !error.field && <Notice tone="danger">{error.message}</Notice>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="ランク名" htmlFor="r-name" required error={errorFor("name")}>
                <Input id="r-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="例: 特賞" invalid={!!errorFor("name")} />
              </Field>
              <Field label="サブタイトル" htmlFor="r-sub" error={errorFor("subtitle")}>
                <Input id="r-sub" value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="例: 大当たり" />
              </Field>
              <Field label="カラー" htmlFor="r-color" error={errorFor("color")}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : "#000000"}
                    onChange={(e) => patch({ color: e.target.value.toUpperCase() })}
                    className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                    aria-label="カラーを選択"
                  />
                  <Input id="r-color" value={form.color} onChange={(e) => patch({ color: e.target.value })} className="font-mono" invalid={!!errorFor("color")} />
                </div>
              </Field>
            </div>
            <MediaPicker label="ロゴ画像（当選時に表示）" value={form.logoUrl} onChange={(url) => patch({ logoUrl: url })} kinds={["image"]} aspect="8/3" />
            <div>
              <p className="mb-2 text-sm font-bold">演出の種類</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => patchEffect({ type: opt.type, url: opt.type === form.effect.type ? form.effect.url : null })}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      form.effect.type === opt.type ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-line hover:bg-surface-2",
                    )}
                  >
                    <Icon name={opt.icon} size={18} className={form.effect.type === opt.type ? "text-primary" : "text-muted"} />
                    <span>
                      <span className="block text-sm font-bold">{opt.title}</span>
                      <span className="block text-xs text-muted">{opt.note}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {form.effect.type !== "builtin" && (
              <div>
                <MediaPicker
                  label={form.effect.type === "video" ? "演出動画（MP4 / WebM）" : "Lottieファイル（JSON）"}
                  value={form.effect.url}
                  onChange={(url) => patchEffect({ url })}
                  kinds={[form.effect.type === "video" ? "video" : "lottie"]}
                  aspect="1/1"
                />
                {errorFor("effect.url") && <p className="mt-1.5 text-xs font-medium text-danger">{errorFor("effect.url")}</p>}
              </div>
            )}
            <Field
              label="内蔵アニメーション"
              htmlFor="r-style"
              hint={form.effect.type === "builtin" ? "このアニメーションが再生されます" : "ファイルの読み込みに失敗した場合の代替演出として使用します"}
            >
              <Select id="r-style" value={form.effect.builtinStyle} onChange={(e) => patchEffect({ builtinStyle: e.target.value as BuiltinEffectStyle })}>
                {(Object.keys(BUILTIN_EFFECT_LABELS) as BuiltinEffectStyle[]).map((s) => (
                  <option key={s} value={s}>
                    {BUILTIN_EFFECT_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <EffectPreviewModal target={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        tone="danger"
        title="ランクを削除しますか？"
        description={deleting ? (deleting.prizeCount > 0 ? `「${deleting.name}」は${deleting.prizeCount}件の景品で使われているため削除できません。` : `「${deleting.name}」を削除します。`) : undefined}
        confirmLabel="削除する"
      />
    </div>
  );
}
