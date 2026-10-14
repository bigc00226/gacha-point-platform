"use client";

import { useState } from "react";
import type { AdminExchangeItemDto } from "@/lib/server/services/exchange";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { MediaPicker } from "@/components/admin/media-picker";

interface ItemForm {
  name: string;
  description: string;
  imageUrl: string | null;
  pointsRequired: string;
  stock: string;
  type: "physical" | "digital";
  active: boolean;
  sortOrder: string;
}

const EMPTY: ItemForm = { name: "", description: "", imageUrl: null, pointsRequired: "10000", stock: "10", type: "physical", active: true, sortOrder: "0" };

function toBody(f: ItemForm) {
  return { ...f, pointsRequired: Number(f.pointsRequired), stock: Number(f.stock), sortOrder: Number(f.sortOrder) };
}

export function ExchangeItemsManager({ initial }: { initial: AdminExchangeItemDto[] }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; form: ItemForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string | null; message: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminExchangeItemDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function itemToForm(i: AdminExchangeItemDto): ItemForm {
    return {
      name: i.name,
      description: i.description,
      imageUrl: i.imageUrl,
      pointsRequired: String(i.pointsRequired),
      stock: String(i.stock),
      type: i.type,
      active: i.active,
      sortOrder: String(i.sortOrder),
    };
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setFieldError(null);
    try {
      const res = editing.id
        ? await api.put<{ items: AdminExchangeItemDto[] }>(`/api/admin/exchange-items/${editing.id}`, toBody(editing.form))
        : await api.post<{ items: AdminExchangeItemDto[] }>("/api/admin/exchange-items", toBody(editing.form));
      setItems(res.items);
      toast.success(editing.id ? "景品を更新しました" : "景品を追加しました", editing.form.name);
      setEditing(null);
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setFieldError({ field, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdate(item: AdminExchangeItemDto, patch: Partial<ItemForm>, message: string) {
    setBusy(item.id);
    try {
      const res = await api.put<{ items: AdminExchangeItemDto[] }>(`/api/admin/exchange-items/${item.id}`, toBody({ ...itemToForm(item), ...patch }));
      setItems(res.items);
      toast.success(message, item.name);
    } catch (err) {
      toast.error("更新できませんでした", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      const res = await api.del<{ items: AdminExchangeItemDto[] }>(`/api/admin/exchange-items/${deleting.id}`);
      setItems(res.items);
      toast.success("景品を削除しました");
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
    } finally {
      setDeleting(null);
      setBusy(null);
    }
  }

  const form = editing?.form;
  const errorFor = (f: string) => (fieldError?.field === f ? fieldError.message : null);
  const patch = (p: Partial<ItemForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          全{items.length}件（公開中 {items.filter((i) => i.active).length}件・在庫切れ {items.filter((i) => i.stock <= 0).length}件）
        </p>
        <Button size="sm" leftIcon="plus" onClick={() => {
          setFieldError(null);
          setEditing({ id: null, form: { ...EMPTY, sortOrder: String(items.length + 1) } });
        }}>
          景品を追加
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="gift" title="交換景品がありません" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>景品</TH>
              <TH>種類</TH>
              <TH className="text-right">必要ポイント</TH>
              <TH className="text-center">在庫</TH>
              <TH className="text-right @max-5xl:hidden">交換数（未発送）</TH>
              <TH>公開</TH>
              <TH className="text-right">操作</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((i) => (
              <TR key={i.id} className="@max-4xl:relative">
                <TD mobile="title" className="@max-4xl:pr-20">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-3">
                      {i.imageUrl && <img src={i.imageUrl} alt="" className="size-10 object-contain" />}
                    </span>
                    <div className="min-w-0 max-w-64 @6xl:max-w-xs">
                      <p className="truncate font-bold">{i.name}</p>
                      <p className="truncate text-xs text-muted">{i.description}</p>
                    </div>
                  </div>
                </TD>
                <TD label="種類">
                  <Badge tone={i.type === "digital" ? "info" : "primary"}>{i.type === "digital" ? "デジタル" : "実物"}</Badge>
                </TD>
                <TD label="必要ポイント" className="tabular text-right font-bold text-point">{formatNumber(i.pointsRequired)}pt</TD>
                <TD label="在庫">
                  <div className="flex items-center justify-center gap-1">
                    <IconButton icon="minus" label="在庫を1減らす" size="xs" variant="secondary" disabled={busy === i.id || i.stock <= 0} onClick={() => quickUpdate(i, { stock: String(i.stock - 1) }, "在庫を更新しました")} />
                    <span className={`tabular w-12 text-center font-bold ${i.stock <= 0 ? "text-danger" : ""}`}>{formatNumber(i.stock)}</span>
                    <IconButton icon="plus" label="在庫を1増やす" size="xs" variant="secondary" disabled={busy === i.id} onClick={() => quickUpdate(i, { stock: String(i.stock + 1) }, "在庫を更新しました")} />
                  </div>
                </TD>
                <TD label="交換数（未発送）" className="tabular text-right text-sm @4xl:@max-5xl:hidden">
                  {formatNumber(i.orderCount)}
                  {i.pendingCount > 0 && <span className="ml-1 text-xs text-warning">（{i.pendingCount}）</span>}
                </TD>
                <TD label="公開">
                  <Switch checked={i.active} onChange={() => quickUpdate(i, { active: !i.active }, i.active ? "非公開にしました" : "公開しました")} disabled={busy === i.id} />
                </TD>
                <TD className="@max-4xl:absolute @max-4xl:right-2 @max-4xl:top-2.5 @max-4xl:w-auto @max-4xl:p-0">
                  <div className="flex justify-end gap-1">
                    <IconButton icon="edit" label="編集" size="sm" onClick={() => {
                      setFieldError(null);
                      setEditing({ id: i.id, form: itemToForm(i) });
                    }} />
                    <IconButton icon="trash" label="削除" size="sm" onClick={() => setDeleting(i)} className="hover:text-danger" />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "交換景品を編集" : "交換景品を追加"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              キャンセル
            </Button>
            <Button leftIcon="check" onClick={save} loading={saving}>
              保存する
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldError && !fieldError.field && <Notice tone="danger" className="sm:col-span-2">{fieldError.message}</Notice>}
            <Field label="景品名" htmlFor="x-name" required error={errorFor("name")} className="sm:col-span-2">
              <Input id="x-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} invalid={!!errorFor("name")} />
            </Field>
            <Field label="説明" htmlFor="x-desc" error={errorFor("description")} className="sm:col-span-2">
              <Textarea id="x-desc" rows={2} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label="必要ポイント" htmlFor="x-points" required error={errorFor("pointsRequired")} hint="例: 150,000pt">
              <Input id="x-points" type="number" min={1} value={form.pointsRequired} onChange={(e) => patch({ pointsRequired: e.target.value })} invalid={!!errorFor("pointsRequired")} />
            </Field>
            <Field label="在庫数" htmlFor="x-stock" required error={errorFor("stock")}>
              <Input id="x-stock" type="number" min={0} value={form.stock} onChange={(e) => patch({ stock: e.target.value })} invalid={!!errorFor("stock")} />
            </Field>
            <Field label="種類" htmlFor="x-type" hint="デジタルは交換後すぐにコードを発行します">
              <Select id="x-type" value={form.type} onChange={(e) => patch({ type: e.target.value as ItemForm["type"] })}>
                <option value="physical">実物景品（発送あり）</option>
                <option value="digital">デジタル（コード発行）</option>
              </Select>
            </Field>
            <Field label="表示順" htmlFor="x-sort" error={errorFor("sortOrder")}>
              <Input id="x-sort" type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <MediaPicker label="画像" value={form.imageUrl} onChange={(url) => patch({ imageUrl: url })} kinds={["image"]} aspect="1/1" />
            </div>
            <Checkbox checked={form.active} onChange={(e) => patch({ active: e.target.checked })} label="交換所に公開する" className="sm:col-span-2" />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={!!deleting && busy === deleting.id}
        tone="danger"
        title="交換景品を削除しますか？"
        description={deleting ? (deleting.orderCount > 0 ? `「${deleting.name}」は交換実績があるため削除できません。非公開にしてください。` : `「${deleting.name}」を削除します。`) : undefined}
        confirmLabel="削除する"
      />
    </Card>
  );
}
