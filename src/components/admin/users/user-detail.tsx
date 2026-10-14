"use client";

import { useState } from "react";
import type { AdminUserDetailDto } from "@/lib/server/services/admin-users";
import { LEDGER_REASON_LABELS, ORDER_STATUS_LABELS, POSTBACK_STATUS_LABELS, USER_PRIZE_STATUS_LABELS } from "@/lib/constants";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge, RankBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DescriptionList, EmptyState, Notice, StatCard } from "@/components/ui/misc";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

type Tab = "ledger" | "draws" | "prizes" | "orders" | "postbacks";

function LedgerTable({ entries }: { entries: AdminUserDetailDto["ledger"] }) {
  const { pageItems, page, pageCount, setPage, total } = usePaged(entries, 20);
  if (entries.length === 0) return <EmptyState icon="history" title="履歴はありません" />;
  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>日時</TH>
            <TH>内容</TH>
            <TH>種別</TH>
            <TH className="text-right">増減</TH>
            <TH className="text-right">残高</TH>
          </tr>
        </THead>
        <TBody>
          {pageItems.map((e) => (
            <TR key={e.id}>
              <TD label="日時" className="whitespace-nowrap text-xs">{formatDateTime(e.createdAt)}</TD>
              <TD mobile="title" className="max-w-72 truncate text-sm @max-4xl:font-bold">{e.description}</TD>
              <TD mobile="hide">
                <Badge size="xs" tone={e.currency === "ticket" ? "ticket" : "point"}>
                  {LEDGER_REASON_LABELS[e.reason]}
                </Badge>
              </TD>
              <TD label="増減" className={cn("tabular text-right font-bold", e.amount >= 0 ? (e.currency === "ticket" ? "text-ticket" : "text-point") : "text-danger")}>
                {e.amount > 0 ? "+" : ""}
                {formatNumber(e.amount)}
                {e.currency === "ticket" ? "枚" : "pt"}
              </TD>
              <TD label="残高" className="tabular text-right text-xs text-muted">
                {formatNumber(e.balanceAfter)}
                {e.currency === "ticket" ? "枚" : "pt"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="border-t border-line px-4 py-3">
        <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
      </div>
    </>
  );
}

export function UserDetail({ initial, selfId }: { initial: AdminUserDetailDto; selfId: string }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("ledger");
  const [adjust, setAdjust] = useState({ currency: "ticket" as "ticket" | "point", amount: "", reason: "" });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const u = data.user;

  async function submitAdjust() {
    setAdjusting(true);
    setAdjustError(null);
    try {
      const res = await api.post<AdminUserDetailDto>(`/api/admin/users/${u.id}/adjust`, { currency: adjust.currency, amount: Number(adjust.amount), reason: adjust.reason });
      setData(res);
      toast.success("残高を調整しました", `${adjust.currency === "ticket" ? "チケット" : "ポイント"} ${Number(adjust.amount) > 0 ? "+" : ""}${formatNumber(Number(adjust.amount))}`);
      setAdjust({ ...adjust, amount: "", reason: "" });
    } catch (err) {
      setAdjustError(err instanceof ApiClientError ? err.message : errorMessage(err));
    } finally {
      setAdjusting(false);
    }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      const res = await api.patch<AdminUserDetailDto>(`/api/admin/users/${u.id}`, { status: u.status === "active" ? "suspended" : "active" });
      setData(res);
      toast.success(res.user.status === "suspended" ? "利用停止にしました" : "利用を再開しました");
    } catch (err) {
      toast.error("変更できませんでした", errorMessage(err));
    } finally {
      setBusy(false);
      setConfirmStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-2xl font-black text-primary">{u.nickname.slice(0, 1)}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">{u.nickname}</h1>
              {u.role === "admin" && <Badge tone="primary" icon="shield">管理者</Badge>}
              <Badge tone={u.status === "active" ? "success" : "danger"}>{u.status === "active" ? "利用中" : "利用停止"}</Badge>
            </div>
            <p className="text-sm text-muted">
              {u.email} ・ <span className="font-mono text-xs">{u.id}</span>
            </p>
          </div>
        </div>
        <Button variant={u.status === "active" ? "danger" : "success"} leftIcon={u.status === "active" ? "ban" : "check"} onClick={() => setConfirmStatus(true)} disabled={u.id === selfId}>
          {u.status === "active" ? "利用停止にする" : "利用を再開する"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="ガチャチケット" value={`${formatNumber(u.tickets)}枚`} icon="ticket" tone="ticket" />
        <StatCard label="ポイント" value={`${formatNumber(u.points)}pt`} icon="coin" tone="point" />
        <StatCard label="ガチャ" value={`${formatNumber(u.draws)}口`} sub={`${formatNumber(data.draws.length)}リクエスト（直近）`} icon="capsule" tone="primary" />
        <StatCard label="本日の動画視聴" value={`${u.videoToday} / ${u.videoLimit}回`} sub={`ログインボーナス ${u.loginClaimedToday ? `受取済（${u.loginStreak}日連続）` : "未受取"}`} icon="tv" tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader icon="user" title="会員情報" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "登録日時", value: formatDateTime(u.createdAt) },
                { label: "最終ログイン", value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—" },
                { label: "獲得景品", value: `${data.prizes.length}件` },
                { label: "注文", value: `${data.orders.length}件` },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon="sliders" title="残高を調整" description="お問い合わせ対応などで、チケット・ポイントを付与または減算します。履歴と操作ログに記録されます。" />
          <CardBody className="space-y-3">
            {adjustError && <Notice tone="danger">{adjustError}</Notice>}
            <div className="grid gap-3 sm:grid-cols-[9rem_9rem_1fr]">
              <Field label="種類" htmlFor="a-cur">
                <Select id="a-cur" value={adjust.currency} onChange={(e) => setAdjust({ ...adjust, currency: e.target.value as "ticket" | "point" })}>
                  <option value="ticket">チケット</option>
                  <option value="point">ポイント</option>
                </Select>
              </Field>
              <Field label="増減（±）" htmlFor="a-amount" hint="例: 100 / -50">
                <Input id="a-amount" type="number" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
              </Field>
              <Field label="理由（必須）" htmlFor="a-reason">
                <Input id="a-reason" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="例: お問い合わせ #1234 の補填" />
              </Field>
            </div>
            <Button leftIcon="check" onClick={submitAdjust} loading={adjusting} disabled={!adjust.amount || Number(adjust.amount) === 0 || !adjust.reason.trim()}>
              調整を実行
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 pt-2">
          <Tabs
            variant="underline"
            value={tab}
            onChange={setTab}
            items={[
              { key: "ledger", label: "付与・消費履歴", count: data.ledger.length },
              { key: "draws", label: "ガチャ履歴", count: data.draws.length },
              { key: "prizes", label: "獲得景品", count: data.prizes.length },
              { key: "orders", label: "注文", count: data.orders.length },
              { key: "postbacks", label: "成果通知", count: data.postbacks.length },
            ]}
          />
        </div>
        {tab === "ledger" && <LedgerTable entries={data.ledger} />}
        {tab === "draws" &&
          (data.draws.length === 0 ? (
            <EmptyState icon="capsule" title="ガチャ履歴はありません" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>日時</TH>
                  <TH>ガチャ</TH>
                  <TH className="text-right">回数</TH>
                  <TH>最高ランク</TH>
                  <TH className="text-right">獲得pt</TH>
                </tr>
              </THead>
              <TBody>
                {data.draws.map((d) => {
                  const best = d.results.reduce((t, r) => (r.rankOrder < t.rankOrder ? r : t), d.results[0]);
                  return (
                    <TR key={d.id}>
                      <TD label="日時" className="whitespace-nowrap text-xs">{formatDateTime(d.createdAt)}</TD>
                      <TD mobile="title" className="text-sm @max-4xl:font-bold">{d.gachaTitle}</TD>
                      <TD label="回数" className="tabular text-right">{d.count}回</TD>
                      <TD label="最高ランク">
                        {best && <RankBadge name={`${best.rankName} ${best.prizeName}`} color={best.rankColor} size="xs" />}
                        {d.lastOne && <Badge tone="gold" size="xs" className="ml-1">ラストワン</Badge>}
                      </TD>
                      <TD label="獲得pt" className="tabular text-right font-bold text-point">{formatNumber(d.pointsGained)}pt</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          ))}
        {tab === "prizes" &&
          (data.prizes.length === 0 ? (
            <EmptyState icon="gift" title="獲得景品はありません" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>獲得日時</TH>
                  <TH>景品</TH>
                  <TH>種類</TH>
                  <TH>状態</TH>
                </tr>
              </THead>
              <TBody>
                {data.prizes.map((p) => (
                  <TR key={p.id}>
                    <TD label="獲得日時" className="whitespace-nowrap text-xs">{formatDateTime(p.createdAt)}</TD>
                    <TD mobile="title" className="text-sm @max-4xl:font-bold">
                      {p.isLastOne ? <Badge tone="gold" size="xs" className="mr-1">ラストワン</Badge> : <RankBadge name={p.rankName} color={p.rankColor} size="xs" />} {p.name}
                    </TD>
                    <TD label="種類" className="text-xs">{p.type === "digital" ? "デジタル" : "実物"}</TD>
                    <TD label="状態">
                      <Badge size="xs" tone={p.status === "shipped" ? "success" : p.status === "owned" ? "warning" : "info"}>
                        {p.type === "digital" ? "コード発行済" : USER_PRIZE_STATUS_LABELS[p.status]}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ))}
        {tab === "orders" &&
          (data.orders.length === 0 ? (
            <EmptyState icon="truck" title="注文はありません" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>申込日時</TH>
                  <TH>景品</TH>
                  <TH className="text-right">ポイント</TH>
                  <TH>状態</TH>
                </tr>
              </THead>
              <TBody>
                {data.orders.map((o) => (
                  <TR key={o.id}>
                    <TD label="申込日時" className="whitespace-nowrap text-xs">{formatDateTime(o.createdAt)}</TD>
                    <TD mobile="title" className="text-sm @max-4xl:font-bold">{o.itemName}</TD>
                    <TD label="ポイント" className="tabular text-right">{o.pointsSpent > 0 ? `${formatNumber(o.pointsSpent)}pt` : "—"}</TD>
                    <TD label="状態">
                      <Badge size="xs" tone={o.status === "pending" ? "warning" : o.status === "shipped" ? "success" : "neutral"}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ))}
        {tab === "postbacks" &&
          (data.postbacks.length === 0 ? (
            <EmptyState icon="signal" title="成果通知はありません" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>受信日時</TH>
                  <TH>種類</TH>
                  <TH>結果</TH>
                  <TH className="text-right">付与</TH>
                </tr>
              </THead>
              <TBody>
                {data.postbacks.map((p) => (
                  <TR key={p.id}>
                    <TD label="受信日時" className="whitespace-nowrap text-xs">{formatDateTime(p.receivedAt)}</TD>
                    <TD mobile="title" className="text-sm @max-4xl:font-bold">
                      {p.kind === "video" ? "動画" : "案件"} / {p.provider}
                    </TD>
                    <TD label="結果">
                      <Badge size="xs" tone={p.status === "granted" ? "success" : p.status === "duplicate" || p.status === "limit_reached" ? "warning" : "danger"}>
                        {POSTBACK_STATUS_LABELS[p.status]}
                      </Badge>
                    </TD>
                    <TD label="付与" className="tabular text-right font-bold text-ticket">{p.ticketsGranted > 0 ? `+${p.ticketsGranted}枚` : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ))}
      </Card>

      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
        loading={busy}
        tone={u.status === "active" ? "danger" : "primary"}
        title={u.status === "active" ? "この会員を利用停止にしますか？" : "利用を再開しますか？"}
        description={u.status === "active" ? "ログイン・ガチャ・交換などすべての操作ができなくなります（データは保持されます）。" : "会員は再びサービスを利用できるようになります。"}
        confirmLabel={u.status === "active" ? "利用停止にする" : "再開する"}
      />
    </div>
  );
}
