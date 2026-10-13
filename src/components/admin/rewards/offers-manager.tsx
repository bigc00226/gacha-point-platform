"use client";

import Link from "next/link";
import { useState } from "react";
import type { OfferCategory, OfferProvider } from "@/lib/types";
import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, OFFER_PROVIDER_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { MediaPicker } from "@/components/admin/media-picker";
import type { AdminOfferDto, AdminOffersDto, OfferInput } from "./types";

const EMPTY: OfferInput = {
  title: "",
  description: "",
  category: "app",
  conditions: "",
  provider: "skyflag",
  estimatedTime: "約5分",
  repeatable: false,
  active: true,
  iconUrl: null,
};

export function OffersManager({ initial }: { initial: AdminOffersDto }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; form: OfferInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string | null; message: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminOfferDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setData(await api.get<AdminOffersDto>("/api/admin/offers"));
  }

  function openNew() {
    setFieldError(null);
    setEditing({ id: null, form: { ...EMPTY, sortOrder: data.offers.length + 1 } });
  }

  function openEdit(o: AdminOfferDto) {
    setFieldError(null);
    setEditing({
      id: o.id,
      form: {
        title: o.title,
        description: o.description,
        category: o.category,
        conditions: o.conditions,
        provider: o.provider,
        estimatedTime: o.estimatedTime,
        repeatable: o.repeatable,
        active: o.active,
        iconUrl: o.iconUrl,
        sortOrder: o.sortOrder,
      },
    });
  }

  function patch<K extends keyof OfferInput>(key: K, value: OfferInput[K]) {
    setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setFieldError(null);
    try {
      if (editing.id) await api.put(`/api/admin/offers/${editing.id}`, editing.form);
      else await api.post("/api/admin/offers", editing.form);
      toast.success(editing.id ? "案件を更新しました" : "案件を追加しました");
      setEditing(null);
      await reload();
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setFieldError({ field, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(o: AdminOfferDto) {
    setBusyId(o.id);
    try {
      await api.put(`/api/admin/offers/${o.id}`, { active: !o.active });
      toast.success(o.active ? "掲載を停止しました" : "掲載を再開しました", o.title);
      await reload();
    } catch (err) {
      toast.error("更新できませんでした", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.del(`/api/admin/offers/${deleting.id}`);
      toast.success("案件を削除しました", "達成履歴とチケット付与履歴は保持されます。");
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const errorFor = (f: string) => (fieldError?.field === f ? fieldError.message : null);
  const form = editing?.form;

  return (
    <div className="space-y-4">
      <Notice tone="info" title={`現在の付与倍率: ×${data.multiplier}`}>
        各案件の付与枚数は「カテゴリ別の付与枚数 × 倍率」で自動計算されます。枚数の変更は
        <Link href="/admin/rewards" className="mx-1 font-bold text-primary underline">
          チケット付与設定
        </Link>
        から行えます。
      </Notice>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="text-sm text-muted">
            全{data.offers.length}件（掲載中 {data.offers.filter((o) => o.active).length}件）
          </p>
          <Button size="sm" leftIcon="plus" onClick={openNew}>
            案件を追加
          </Button>
        </div>
        {data.offers.length === 0 ? (
          <EmptyState icon="smartphone" title="案件がありません" action={<Button onClick={openNew}>案件を追加</Button>} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>案件</TH>
                <TH>配信元</TH>
                <TH>カテゴリ</TH>
                <TH className="text-right">付与数</TH>
                <TH className="text-right">達成（本日 / 累計）</TH>
                <TH>掲載</TH>
                <TH className="text-right">操作</TH>
              </tr>
            </THead>
            <TBody>
              {data.offers.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      {o.iconUrl ? (
                        <img src={o.iconUrl} alt="" className="size-10 shrink-0 rounded-xl" />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-xl bg-surface-3 text-muted">
                          <Icon name="smartphone" size={18} />
                        </span>
                      )}
                      <div className="min-w-0 max-w-xs">
                        <p className="truncate font-bold">{o.title}</p>
                        <p className="truncate text-xs text-muted">{o.conditions}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone="neutral">{OFFER_PROVIDER_LABELS[o.provider]}</Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="info">{OFFER_CATEGORY_LABELS[o.category]}</Badge>
                      {o.repeatable && <Badge tone="success">毎日</Badge>}
                    </div>
                  </TD>
                  <TD className="tabular text-right font-bold text-ticket">{formatNumber(o.tickets)}枚</TD>
                  <TD className="tabular text-right">
                    {formatNumber(o.completions.today)} / {formatNumber(o.completions.total)}
                    <p className="text-[11px] text-muted">計 {formatNumber(o.completions.ticketsTotal)}枚</p>
                  </TD>
                  <TD>
                    <Switch checked={o.active} onChange={() => toggleActive(o)} disabled={busyId === o.id} label={o.active ? "掲載中" : "停止中"} />
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <IconButton icon="edit" label="編集" size="sm" onClick={() => openEdit(o)} />
                      <IconButton icon="trash" label="削除" size="sm" onClick={() => setDeleting(o)} className="hover:text-danger" />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "案件を編集" : "案件を追加"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={save} loading={saving} leftIcon="check">
              保存する
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldError && !fieldError.field && <Notice tone="danger" className="sm:col-span-2">{fieldError.message}</Notice>}
            <Field label="案件名" htmlFor="o-title" required error={errorFor("title")} className="sm:col-span-2">
              <Input id="o-title" value={form.title} onChange={(e) => patch("title", e.target.value)} invalid={!!errorFor("title")} />
            </Field>
            <Field label="配信元" htmlFor="o-provider" required>
              <Select id="o-provider" value={form.provider} onChange={(e) => patch("provider", e.target.value as OfferProvider)}>
                {Object.entries(OFFER_PROVIDER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="カテゴリ" htmlFor="o-category" required hint={`付与数: ${formatNumber(Math.round(data.categoryTickets[form.category] * data.multiplier))}枚`}>
              <Select id="o-category" value={form.category} onChange={(e) => patch("category", e.target.value as OfferCategory)}>
                {OFFER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {OFFER_CATEGORY_LABELS[c]}（{formatNumber(data.categoryTickets[c])}枚）
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="達成条件" htmlFor="o-cond" required error={errorFor("conditions")} className="sm:col-span-2">
              <Input id="o-cond" value={form.conditions} onChange={(e) => patch("conditions", e.target.value)} placeholder="例: 新規インストール後、ステージ20をクリア" invalid={!!errorFor("conditions")} />
            </Field>
            <Field label="説明" htmlFor="o-desc" error={errorFor("description")} className="sm:col-span-2">
              <Textarea id="o-desc" value={form.description} onChange={(e) => patch("description", e.target.value)} rows={3} />
            </Field>
            <Field label="目安時間" htmlFor="o-time" error={errorFor("estimatedTime")}>
              <Input id="o-time" value={form.estimatedTime} onChange={(e) => patch("estimatedTime", e.target.value)} placeholder="約5分" />
            </Field>
            <Field label="表示順" htmlFor="o-sort" error={errorFor("sortOrder")}>
              <Input id="o-sort" type="number" value={form.sortOrder ?? 0} onChange={(e) => patch("sortOrder", Number(e.target.value))} />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Checkbox checked={form.repeatable} onChange={(e) => patch("repeatable", e.target.checked)} label="毎日達成できる案件にする" description="オフの場合はおひとり様1回まで。オンの場合は1日1回まで（毎日0:00リセット）。" />
              <Checkbox checked={form.active} onChange={(e) => patch("active", e.target.checked)} label="掲載する" />
            </div>
            <div className="sm:col-span-2">
              <MediaPicker label="アイコン画像" value={form.iconUrl} onChange={(url) => patch("iconUrl", url)} kinds={["image"]} aspect="1/1" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={!!deleting && busyId === deleting.id}
        tone="danger"
        title="案件を削除しますか？"
        description={deleting ? `「${deleting.title}」を削除します。これまでの達成履歴・付与履歴は保持されます。一時的に止めたい場合は「掲載」をオフにしてください。` : undefined}
        confirmLabel="削除する"
      />
    </div>
  );
}
