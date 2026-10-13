"use client";

import { useState } from "react";
import type { CouponRedemption } from "@/lib/types";
import type { CouponDto, CouponKpisDto, CouponState } from "@/lib/server/services/coupons";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { downloadCsv } from "@/lib/client/csv";
import { cn, formatNumber } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { EmptyState, Notice, ProgressBar, StatCard } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

interface ListDto {
  coupons: CouponDto[];
  kpis: CouponKpisDto;
}

const STATE_LABEL: Record<CouponState, string> = { active: "有効", exhausted: "上限到達", expired: "期限切れ", disabled: "停止中" };
const STATE_TONE: Record<CouponState, BadgeTone> = { active: "success", exhausted: "warning", expired: "neutral", disabled: "danger" };

function localToIso(v: string): string | null {
  return v ? new Date(`${v}:00+09:00`).toISOString() : null;
}

export function CouponsManager({ initial }: { initial: ListDto }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [mode, setMode] = useState<"single" | "shared">("single");
  const [single, setSingle] = useState({ points: "1000", quantity: "10", prefix: "PG", label: "", expiresAt: "" });
  const [shared, setShared] = useState({ keyword: "", points: "500", maxUses: "100", label: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string | null; message: string } | null>(null);
  const [created, setCreated] = useState<CouponDto[] | null>(null);
  const [filter, setFilter] = useState<{ type: "" | "single" | "shared"; state: "" | CouponState; q: string }>({ type: "", state: "", q: "" });
  const [history, setHistory] = useState<{ coupon: CouponDto; rows: CouponRedemption[] | null } | null>(null);
  const [deleting, setDeleting] = useState<CouponDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setFieldError(null);
    try {
      const body =
        mode === "single"
          ? { type: "single", points: Number(single.points), quantity: Number(single.quantity), prefix: single.prefix, label: single.label, expiresAt: localToIso(single.expiresAt) }
          : { type: "shared", keyword: shared.keyword, points: Number(shared.points), maxUses: Number(shared.maxUses), label: shared.label, expiresAt: localToIso(shared.expiresAt) };
      const res = await api.post<ListDto & { created: CouponDto[] }>("/api/admin/coupons", body);
      setData({ coupons: res.coupons, kpis: res.kpis });
      setCreated(res.created);
      toast.success(mode === "single" ? `使い捨てコードを${res.created.length}件発行しました` : "あいことばを登録しました");
      if (mode === "shared") setShared((s) => ({ ...s, keyword: "" }));
    } catch (err) {
      const field = err instanceof ApiClientError ? ((err.details as { field?: string } | undefined)?.field ?? null) : null;
      setFieldError({ field, message: errorMessage(err) });
    } finally {
      setCreating(false);
    }
  }

  async function toggle(c: CouponDto) {
    setBusy(c.id);
    try {
      setData(await api.patch<ListDto>(`/api/admin/coupons/${c.id}`, { active: !c.active }));
      toast.success(c.active ? "コードを停止しました" : "コードを有効にしました", c.displayCode);
    } catch (err) {
      toast.error("変更できませんでした", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      setData(await api.del<ListDto>(`/api/admin/coupons/${deleting.id}`));
      toast.success("コードを削除しました");
      setDeleting(null);
    } catch (err) {
      toast.error("削除できませんでした", errorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(null);
    }
  }

  async function openHistory(c: CouponDto) {
    setHistory({ coupon: c, rows: null });
    try {
      const res = await api.get<{ redemptions: CouponRedemption[] }>(`/api/admin/coupons/${c.id}/redemptions`);
      setHistory({ coupon: c, rows: res.redemptions });
    } catch (err) {
      toast.error("利用履歴を取得できませんでした", errorMessage(err));
      setHistory(null);
    }
  }

  function exportBatch(batchId: string | null) {
    const rows = data.coupons.filter((c) => (batchId ? c.batchId === batchId : c.type === "single"));
    downloadCsv(`coupons_${batchId ?? "single"}.csv`, [
      ["コード", "ポイント", "状態", "メモ", "有効期限", "発行日時"],
      ...rows.map((c) => [c.displayCode, c.points, STATE_LABEL[c.state], c.label, c.expiresAt ? formatDateTime(c.expiresAt) : "", formatDateTime(c.createdAt)]),
    ]);
  }

  const q = filter.q.trim().toLowerCase();
  const list = data.coupons.filter(
    (c) =>
      (!filter.type || c.type === filter.type) &&
      (!filter.state || c.state === filter.state) &&
      (!q || c.displayCode.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)),
  );
  const { pageItems, page, pageCount, setPage, total } = usePaged(list, 20);
  const errorFor = (f: string) => (fieldError?.field === f ? fieldError.message : null);
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="有効なコード" value={formatNumber(k.activeCodes)} icon="coupon" tone="primary" />
        <StatCard label="本日の利用" value={`${formatNumber(k.redemptionsToday)}件`} icon="activity" tone="info" />
        <StatCard label="付与済みポイント" value={`${formatNumber(k.redeemedPoints)}pt`} icon="coin" tone="point" />
        <StatCard label="発行上限ポイント" value={`${formatNumber(k.issuedPoints)}pt`} sub="全コードの上限まで使われた場合" icon="trendingUp" tone="warning" />
      </div>

      <Card>
        <CardHeader icon="plus" title="コードを発行" description="付与ポイントは100pt以上で自由に設定できます。" />
        <CardBody className="space-y-4">
          <Tabs
            items={[
              { key: "single", label: "使い捨て型（DM配布用）", icon: "key" },
              { key: "shared", label: "先着限定型（あいことば）", icon: "megaphone" },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setFieldError(null);
              setCreated(null);
            }}
          />
          <Notice tone="neutral">
            {mode === "single"
              ? "1回使われると即座に無効になるコードを、指定した数だけランダムに発行します（流出による不正取得を防止）。"
              : "全員共通のあいことばを登録します。指定した人数に達すると自動で受付終了になります（おひとり様1回まで）。"}
          </Notice>
          {fieldError && !fieldError.field && <Notice tone="danger">{fieldError.message}</Notice>}
          {mode === "single" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="付与ポイント" htmlFor="s-points" required error={errorFor("points")}>
                <Input id="s-points" type="number" min={100} value={single.points} onChange={(e) => setSingle({ ...single, points: e.target.value })} invalid={!!errorFor("points")} />
              </Field>
              <Field label="発行数" htmlFor="s-qty" required error={errorFor("quantity")} hint="1〜500件">
                <Input id="s-qty" type="number" min={1} max={500} value={single.quantity} onChange={(e) => setSingle({ ...single, quantity: e.target.value })} invalid={!!errorFor("quantity")} />
              </Field>
              <Field label="接頭辞" htmlFor="s-prefix" error={errorFor("prefix")} hint="英字2〜6文字">
                <Input id="s-prefix" value={single.prefix} onChange={(e) => setSingle({ ...single, prefix: e.target.value.toUpperCase() })} maxLength={6} invalid={!!errorFor("prefix")} />
              </Field>
              <Field label="メモ" htmlFor="s-label" error={errorFor("label")}>
                <Input id="s-label" value={single.label} onChange={(e) => setSingle({ ...single, label: e.target.value })} placeholder="例: 10月DM配布用" />
              </Field>
              <Field label="有効期限（任意）" htmlFor="s-exp" error={errorFor("expiresAt")}>
                <Input id="s-exp" type="datetime-local" value={single.expiresAt} onChange={(e) => setSingle({ ...single, expiresAt: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="あいことば" htmlFor="h-keyword" required error={errorFor("keyword")} hint="日本語・英数字OK">
                <Input id="h-keyword" value={shared.keyword} onChange={(e) => setShared({ ...shared, keyword: e.target.value })} placeholder="例: ポイガチャ1周年" invalid={!!errorFor("keyword")} />
              </Field>
              <Field label="付与ポイント" htmlFor="h-points" required error={errorFor("points")}>
                <Input id="h-points" type="number" min={100} value={shared.points} onChange={(e) => setShared({ ...shared, points: e.target.value })} invalid={!!errorFor("points")} />
              </Field>
              <Field label="先着人数" htmlFor="h-max" required error={errorFor("maxUses")}>
                <Input id="h-max" type="number" min={1} value={shared.maxUses} onChange={(e) => setShared({ ...shared, maxUses: e.target.value })} invalid={!!errorFor("maxUses")} />
              </Field>
              <Field label="メモ" htmlFor="h-label" error={errorFor("label")}>
                <Input id="h-label" value={shared.label} onChange={(e) => setShared({ ...shared, label: e.target.value })} placeholder="例: 公式X 1周年企画" />
              </Field>
              <Field label="有効期限（任意）" htmlFor="h-exp" error={errorFor("expiresAt")}>
                <Input id="h-exp" type="datetime-local" value={shared.expiresAt} onChange={(e) => setShared({ ...shared, expiresAt: e.target.value })} />
              </Field>
            </div>
          )}
          <Button leftIcon="plus" onClick={create} loading={creating}>
            {mode === "single" ? "コードを発行する" : "あいことばを登録する"}
          </Button>
          {created && created.length > 0 && (
            <div className="rounded-xl border border-success/40 bg-success/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-success">{created.length}件のコードを発行しました</p>
                <div className="flex gap-2">
                  <CopyButton text={created.map((c) => c.displayCode).join("\n")} label="すべてコピー" />
                  {created[0].type === "single" && (
                    <Button size="xs" variant="secondary" leftIcon="download" onClick={() => exportBatch(created[0].batchId)}>
                      CSV
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {created.map((c) => (
                  <code key={c.id} className="rounded-md bg-surface px-2 py-1 font-mono text-xs ring-1 ring-line">
                    {c.displayCode}
                  </code>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="種類" htmlFor="f-type">
              <Select id="f-type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value as typeof filter.type })}>
                <option value="">すべて</option>
                <option value="single">使い捨て型</option>
                <option value="shared">先着限定型</option>
              </Select>
            </Field>
            <Field label="状態" htmlFor="f-state">
              <Select id="f-state" value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value as typeof filter.state })}>
                <option value="">すべて</option>
                {(Object.keys(STATE_LABEL) as CouponState[]).map((s) => (
                  <option key={s} value={s}>
                    {STATE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="検索" htmlFor="f-q" className="col-span-2 sm:col-span-1">
              <Input id="f-q" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="コード・メモ" />
            </Field>
          </div>
          <Button variant="secondary" leftIcon="download" onClick={() => exportBatch(null)}>
            使い捨てコードをCSV出力
          </Button>
        </div>
        {list.length === 0 ? (
          <EmptyState icon="coupon" title="該当するコードはありません" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>コード</TH>
                <TH>種類</TH>
                <TH className="text-right">付与</TH>
                <TH className="w-44">利用状況</TH>
                <TH>状態</TH>
                <TH>有効期限</TH>
                <TH>メモ</TH>
                <TH className="text-right">操作</TH>
              </tr>
            </THead>
            <TBody>
              {pageItems.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-sm font-bold">{c.displayCode}</code>
                      <CopyButton text={c.displayCode} label="" copiedLabel="" className="px-1.5" />
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={c.type === "single" ? "info" : "primary"}>{c.type === "single" ? "使い捨て" : "先着限定"}</Badge>
                  </TD>
                  <TD className="tabular text-right font-bold text-point">{formatNumber(c.points)}pt</TD>
                  <TD>
                    <p className="tabular text-xs">
                      {formatNumber(c.usedCount)} / {formatNumber(c.maxUses)}
                    </p>
                    <ProgressBar value={c.usedCount} max={c.maxUses} size="sm" tone={c.usedCount >= c.maxUses ? "danger" : "primary"} className="mt-1" />
                  </TD>
                  <TD>
                    <Badge tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Badge>
                  </TD>
                  <TD className="text-xs text-muted">{c.expiresAt ? formatDate(c.expiresAt) : "なし"}</TD>
                  <TD className="max-w-48 truncate text-xs text-muted">{c.label}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Switch checked={c.active} onChange={() => toggle(c)} disabled={busy === c.id} />
                      <IconButton icon="history" label="利用履歴" size="xs" onClick={() => openHistory(c)} />
                      <IconButton icon="trash" label="削除" size="xs" onClick={() => setDeleting(c)} disabled={c.usedCount > 0} className={cn(c.usedCount === 0 && "hover:text-danger")} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="border-t border-line px-4 py-3">
          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
        </div>
      </Card>

      <Modal open={!!history} onClose={() => setHistory(null)} title={history ? `利用履歴：${history.coupon.displayCode}` : undefined} size="md">
        {history &&
          (history.rows === null ? (
            <p className="py-6 text-center text-sm text-muted">読み込み中…</p>
          ) : history.rows.length === 0 ? (
            <EmptyState icon="history" title="まだ利用されていません" className="py-8" />
          ) : (
            <ul className="divide-y divide-line">
              {history.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {r.userNickname} <span className="text-xs text-muted">({r.userId})</span>
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
                  <span className="tabular font-bold text-point">+{formatNumber(r.points)}pt</span>
                </li>
              ))}
            </ul>
          ))}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={!!deleting && busy === deleting.id}
        tone="danger"
        title="コードを削除しますか？"
        description={deleting ? `「${deleting.displayCode}」を削除します。` : undefined}
        confirmLabel="削除する"
      />
    </div>
  );
}
