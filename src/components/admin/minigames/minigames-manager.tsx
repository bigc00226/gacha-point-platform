"use client";

import { useState } from "react";
import type { MiniGameSlot } from "@/lib/types";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MediaPicker } from "@/components/admin/media-picker";
import { MiniGameFrame } from "@/components/minigames/minigame-grid";

type Form = Omit<MiniGameSlot, "id" | "createdAt" | "updatedAt">;
const EMPTY: Form = { title: "", description: "", provider: "", embedUrl: "", thumbnailUrl: null, aspectRatio: "16:9", active: true, sortOrder: 0 };

export function MiniGamesManager({ initial }: { initial: MiniGameSlot[] }) {
  const toast = useToast();
  const [games, setGames] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null);
  const [preview, setPreview] = useState<MiniGameSlot | null>(null);
  const [deleting, setDeleting] = useState<MiniGameSlot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = editing.id
        ? await api.put<{ games: MiniGameSlot[] }>(`/api/admin/minigames/${editing.id}`, editing.form)
        : await api.post<{ games: MiniGameSlot[] }>("/api/admin/minigames", editing.form);
      setGames(res.games);
      toast.success("ミニゲーム枠を保存しました", editing.form.title);
      setEditing(null);
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setError({ field, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(g: MiniGameSlot) {
    setBusy(g.id);
    try {
      const { id, createdAt, updatedAt, ...rest } = g;
      void createdAt;
      void updatedAt;
      setGames((await api.put<{ games: MiniGameSlot[] }>(`/api/admin/minigames/${id}`, { ...rest, active: !g.active })).games);
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
      setGames((await api.del<{ games: MiniGameSlot[] }>(`/api/admin/minigames/${deleting.id}`)).games);
      toast.success("削除しました");
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
    } finally {
      setDeleting(null);
      setBusy(null);
    }
  }

  const form = editing?.form;
  const patch = (p: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));
  const errorFor = (f: string) => (error?.field === f ? error.message : null);

  return (
    <div className="space-y-4">
      <Notice tone="info" title="外部ミニゲームの追加方法">
        ゲーム提供会社（GMO等）から発行される埋め込み用URLを登録するだけで、ユーザー画面の「ミニゲーム」に表示されます。URLが未設定の枠は「近日公開」として表示されます。
      </Notice>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm text-muted">全{games.length}枠</p>
          <Button size="sm" leftIcon="plus" onClick={() => {
            setError(null);
            setEditing({ id: null, form: { ...EMPTY, sortOrder: games.length + 1 } });
          }}>
            枠を追加
          </Button>
        </div>
        {games.length === 0 ? (
          <EmptyState icon="gamepad" title="ミニゲーム枠がありません" />
        ) : (
          <ul className="divide-y divide-line">
            {games.map((g) => (
              <li key={g.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <span className="block aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                  {g.thumbnailUrl && <img src={g.thumbnailUrl} alt="" className="size-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold">{g.title}</p>
                    <Badge size="xs" tone={g.embedUrl ? "success" : "gold"}>{g.embedUrl ? "公開可能" : "準備中（URL未設定）"}</Badge>
                    <Badge size="xs" tone="neutral">{g.aspectRatio}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted">{g.embedUrl || "埋め込みURL未設定"}</p>
                  <p className="text-xs text-subtle">提供: {g.provider || "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={g.active} onChange={() => toggle(g)} disabled={busy === g.id} label={g.active ? "公開" : "非公開"} />
                  <Button size="sm" variant="secondary" leftIcon="play" onClick={() => setPreview(g)} disabled={!g.embedUrl}>
                    プレビュー
                  </Button>
                  <IconButton icon="edit" label="編集" size="sm" onClick={() => {
                    setError(null);
                    const { id, createdAt, updatedAt, ...rest } = g;
                    void createdAt;
                    void updatedAt;
                    setEditing({ id, form: rest });
                  }} />
                  <IconButton icon="trash" label="削除" size="sm" onClick={() => setDeleting(g)} className="hover:text-danger" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "ミニゲーム枠を編集" : "ミニゲーム枠を追加"}
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
            {error && !error.field && <Notice tone="danger" className="sm:col-span-2">{error.message}</Notice>}
            <Field label="タイトル" htmlFor="mg-title" required error={errorFor("title")}>
              <Input id="mg-title" value={form.title} onChange={(e) => patch({ title: e.target.value })} invalid={!!errorFor("title")} />
            </Field>
            <Field label="提供元" htmlFor="mg-provider" error={errorFor("provider")}>
              <Input id="mg-provider" value={form.provider} onChange={(e) => patch({ provider: e.target.value })} placeholder="例: GMO" />
            </Field>
            <Field label="埋め込みURL" htmlFor="mg-url" error={errorFor("embedUrl")} hint="https://〜 または サイト内パス（例: /embed/coin-catch）。空欄なら「近日公開」" className="sm:col-span-2">
              <Input id="mg-url" value={form.embedUrl} onChange={(e) => patch({ embedUrl: e.target.value })} placeholder="https://" invalid={!!errorFor("embedUrl")} />
            </Field>
            <Field label="説明" htmlFor="mg-desc" className="sm:col-span-2">
              <Textarea id="mg-desc" rows={2} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label="縦横比" htmlFor="mg-aspect">
              <Select id="mg-aspect" value={form.aspectRatio} onChange={(e) => patch({ aspectRatio: e.target.value as Form["aspectRatio"] })}>
                <option value="16:9">16:9（横長）</option>
                <option value="4:3">4:3</option>
                <option value="1:1">1:1（正方形）</option>
                <option value="9:16">9:16（縦長）</option>
              </Select>
            </Field>
            <Field label="表示順" htmlFor="mg-sort">
              <Input id="mg-sort" type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) })} />
            </Field>
            <div className="sm:col-span-2">
              <MediaPicker label="サムネイル" value={form.thumbnailUrl} onChange={(url) => patch({ thumbnailUrl: url })} kinds={["image"]} aspect="16/9" />
            </div>
            <Checkbox checked={form.active} onChange={(e) => patch({ active: e.target.checked })} label="ユーザー画面に表示する" className="sm:col-span-2" />
          </div>
        )}
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `プレビュー：${preview.title}` : undefined} size="xl">
        {preview && <MiniGameFrame game={preview} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={!!deleting && busy === deleting.id}
        tone="danger"
        title="ミニゲーム枠を削除しますか？"
        description={deleting ? `「${deleting.title}」を削除します。` : undefined}
        confirmLabel="削除する"
      />
    </div>
  );
}
