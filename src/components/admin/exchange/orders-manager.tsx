"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderSource, OrderStatus } from "@/lib/types";
import type { AdminOrderDto, OrderKpisDto } from "@/lib/server/services/exchange";
import { ADDRESS_LABELS, formatAddress } from "@/lib/address";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { api, errorMessage } from "@/lib/client/api";
import { downloadCsv } from "@/lib/client/csv";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Notice, StatCard } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

interface ListDto {
  orders: AdminOrderDto[];
  kpis: OrderKpisDto;
}

const STATUS_TONE: Record<OrderStatus, BadgeTone> = { pending: "warning", shipped: "success", cancelled: "neutral" };

export function OrdersManager({ initial }: { initial: ListDto }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<{ status: "" | OrderStatus; source: "" | OrderSource; type: "" | "physical" | "digital"; q: string }>({
    status: "pending",
    source: "",
    type: "",
    q: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AdminOrderDto | null>(null);
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const q = filter.q.trim().toLowerCase();
  const list = data.orders.filter(
    (o) =>
      (!filter.status || o.status === filter.status) &&
      (!filter.source || o.source === filter.source) &&
      (!filter.type || o.itemType === filter.type) &&
      (!q || o.userNickname.toLowerCase().includes(q) || o.itemName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.userEmail.toLowerCase().includes(q)),
  );
  const { pageItems, page, pageCount, setPage, total } = usePaged(list, 20);
  const pendingOnPage = pageItems.filter((o) => o.status === "pending");

  function openDetail(o: AdminOrderDto) {
    setDetail(o);
    setTracking(o.trackingNumber ?? "");
    setNote(o.adminNote);
    setConfirmCancel(false);
  }

  async function act(action: "ship" | "cancel" | "note") {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await api.patch<ListDto & { order: AdminOrderDto }>(`/api/admin/orders/${detail.id}`, { action, trackingNumber: tracking, adminNote: note });
      setData({ orders: res.orders, kpis: res.kpis });
      setDetail(res.order);
      toast.success(action === "ship" ? "発送済にしました" : action === "cancel" ? "注文をキャンセルしました" : "メモを保存しました", res.order.itemName);
      setConfirmCancel(false);
      router.refresh();
    } catch (err) {
      toast.error("更新できませんでした", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function bulkShip() {
    setBusy(true);
    try {
      const res = await api.post<ListDto & { shipped: number }>("/api/admin/orders/bulk-ship", { ids: [...selected] });
      setData({ orders: res.orders, kpis: res.kpis });
      setSelected(new Set());
      toast.success(`${res.shipped}件を発送済にしました`);
      router.refresh();
    } catch (err) {
      toast.error("更新できませんでした", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function exportPending() {
    const rows = data.orders.filter((o) => o.status === "pending" && o.itemType === "physical" && o.address);
    downloadCsv(`shipping_${new Date().toISOString().slice(0, 10)}.csv`, [
      ["注文番号", "申込日時", "区分", "景品", "お名前", "郵便番号", "都道府県", "市区町村", "番地", "建物名", "電話番号", "会員ID", "メール"],
      ...rows.map((o) => [
        o.id,
        formatDateTime(o.createdAt),
        ORDER_SOURCE_LABELS[o.source],
        o.itemName,
        o.address!.fullName,
        o.address!.postalCode,
        o.address!.prefecture,
        o.address!.city,
        o.address!.addressLine,
        o.address!.building,
        o.address!.phone,
        o.userId,
        o.userEmail,
      ]),
    ]);
    toast.success(`未発送 ${rows.length}件の宛名をCSVに出力しました`);
  }

  function toggleAll() {
    const ids = pendingOnPage.map((o) => o.id);
    const all = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const k = data.kpis;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="未発送" value={`${formatNumber(k.pending)}件`} icon="package" tone={k.pending > 0 ? "warning" : "success"} />
        <StatCard label="本日の申込" value={`${formatNumber(k.todayRequests)}件`} icon="activity" tone="info" />
        <StatCard label="今週の発送" value={`${formatNumber(k.shippedThisWeek)}件`} icon="truck" tone="success" />
        <StatCard label="累計" value={`${formatNumber(k.total)}件`} icon="archive" tone="primary" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="状態" htmlFor="o-status">
              <Select id="o-status" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}>
                <option value="">すべて</option>
                {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="区分" htmlFor="o-source">
              <Select id="o-source" value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value as typeof filter.source })}>
                <option value="">すべて</option>
                <option value="exchange">ポイント交換</option>
                <option value="gacha_prize">ガチャ景品</option>
              </Select>
            </Field>
            <Field label="種類" htmlFor="o-type">
              <Select id="o-type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value as typeof filter.type })}>
                <option value="">すべて</option>
                <option value="physical">実物</option>
                <option value="digital">デジタル</option>
              </Select>
            </Field>
            <Field label="検索" htmlFor="o-q">
              <Input id="o-q" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="会員・景品・注文番号" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon="download" onClick={exportPending}>
              未発送の宛名をCSV出力
            </Button>
            <Button leftIcon="truck" onClick={bulkShip} disabled={selected.size === 0} loading={busy && selected.size > 0}>
              選択した{selected.size > 0 ? `${selected.size}件` : "注文"}を発送済にする
            </Button>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon="truck" title="該当する注文はありません" className="py-12" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    aria-label="このページの未発送をすべて選択"
                    checked={pendingOnPage.length > 0 && pendingOnPage.every((o) => selected.has(o.id))}
                    onChange={toggleAll}
                    disabled={pendingOnPage.length === 0}
                    className="size-4 accent-(--primary)"
                  />
                </TH>
                <TH>申込日時</TH>
                <TH>会員</TH>
                <TH>景品</TH>
                <TH>区分</TH>
                <TH>状態</TH>
                <TH>お届け先</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {pageItems.map((o) => (
                <TR key={o.id} className={cn(selected.has(o.id) && "bg-primary/5")}>
                  <TD>
                    <input
                      type="checkbox"
                      aria-label={`${o.itemName}を選択`}
                      checked={selected.has(o.id)}
                      disabled={o.status !== "pending"}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          return next;
                        })
                      }
                      className="size-4 accent-(--primary)"
                    />
                  </TD>
                  <TD className="tabular whitespace-nowrap text-xs">{formatDateTime(o.createdAt)}</TD>
                  <TD className="text-sm">
                    <Link href={`/admin/users/${o.userId}`} className="font-bold hover:underline">
                      {o.userNickname}
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3">
                        {o.imageUrl && <img src={o.imageUrl} alt="" className="size-7 object-contain" />}
                      </span>
                      <span className="max-w-52 truncate text-sm">{o.itemName}</span>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={o.source === "exchange" ? "point" : "primary"} size="xs">
                      {ORDER_SOURCE_LABELS[o.source]}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[o.status]}>{o.itemType === "digital" && o.status === "shipped" ? "発行済" : ORDER_STATUS_LABELS[o.status]}</Badge>
                  </TD>
                  <TD className="max-w-60 truncate text-xs text-muted">{o.address ? `${o.address.prefecture}${o.address.city} ${o.address.fullName}` : "—（デジタル）"}</TD>
                  <TD>
                    <Button size="xs" variant="secondary" onClick={() => openDetail(o)}>
                      詳細
                    </Button>
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

      <Modal open={!!detail} onClose={() => !busy && setDetail(null)} title={detail ? `注文詳細：${detail.itemName}` : undefined} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={STATUS_TONE[detail.status]}>{ORDER_STATUS_LABELS[detail.status]}</Badge>
              <Badge tone="neutral">{ORDER_SOURCE_LABELS[detail.source]}</Badge>
              <span className="text-muted">注文番号 {detail.id}</span>
              <span className="text-muted">申込 {formatDateTime(detail.createdAt)}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="mb-2 text-xs font-bold text-muted">会員</p>
                <p className="font-bold">
                  <Link href={`/admin/users/${detail.userId}`} className="hover:underline">
                    {detail.userNickname}
                  </Link>
                </p>
                <p className="text-xs text-muted">{detail.userEmail}</p>
                {detail.pointsSpent > 0 && <p className="mt-2 text-sm">使用ポイント: <span className="font-bold text-point">{formatNumber(detail.pointsSpent)}pt</span></p>}
              </div>
              <div className="rounded-xl border border-line p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-muted">お届け先</p>
                  {detail.address && <CopyButton text={`${formatAddress(detail.address)}\n${detail.address.fullName} 様\n${detail.address.phone}`} label="住所をコピー" />}
                </div>
                {detail.address ? (
                  <dl className="space-y-1 text-sm">
                    {(Object.keys(ADDRESS_LABELS) as Array<keyof typeof ADDRESS_LABELS>).map((key) => (
                      <div key={key} className="flex gap-2">
                        <dt className="w-24 shrink-0 text-xs text-muted">{ADDRESS_LABELS[key]}</dt>
                        <dd>{detail.address![key] || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted">デジタル景品のため住所はありません</p>
                )}
              </div>
            </div>
            {detail.digitalCode && (
              <p className="text-sm">
                発行コード: <code className="font-mono font-bold">{detail.digitalCode}</code>
              </p>
            )}
            {detail.status === "pending" ? (
              <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
                {detail.itemType === "physical" && (
                  <Field label="追跡番号（任意）" htmlFor="o-tracking">
                    <Input id="o-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="例: 1234-5678-9012" />
                  </Field>
                )}
                <Field label="管理メモ" htmlFor="o-note">
                  <Textarea id="o-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                {confirmCancel ? (
                  <Notice tone="warning" title="この注文をキャンセルしますか？">
                    {detail.source === "exchange" ? `使用された${formatNumber(detail.pointsSpent)}ptを会員に返還し、在庫を1つ戻します。` : "景品を「未申請」に戻します（会員が再度発送を依頼できます）。"}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => act("cancel")} loading={busy}>
                        キャンセルする
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy}>
                        やめる
                      </Button>
                    </div>
                  </Notice>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button leftIcon="truck" onClick={() => act("ship")} loading={busy}>
                      発送済にする
                    </Button>
                    <Button variant="secondary" onClick={() => act("note")} disabled={busy}>
                      メモを保存
                    </Button>
                    <Button variant="ghost" className="text-danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
                      キャンセル
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 rounded-xl border border-line bg-surface-2 p-4 text-sm">
                {detail.shippedAt && (
                  <p>
                    <Icon name="truck" size={14} className="mr-1 inline text-muted" />
                    {formatDateTime(detail.shippedAt)} {detail.itemType === "digital" ? "発行" : "発送"}
                    {detail.trackingNumber && `（追跡番号 ${detail.trackingNumber}）`}
                  </p>
                )}
                {detail.adminNote && <p className="text-muted">メモ: {detail.adminNote}</p>}
                {detail.status === "cancelled" && <p className="text-muted">この注文はキャンセルされています。</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
