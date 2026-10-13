import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { buildDashboard } from "@/lib/server/services/admin-stats";
import { GACHA_STATUS_LABELS, POSTBACK_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { formatDateTime, formatRelative, nowMs } from "@/lib/time";
import { Badge, RankBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState, PageHeader, ProgressBar, StatCard } from "@/components/ui/misc";
import { BarChart, HBarList } from "@/components/admin/dashboard/charts";

export const metadata: Metadata = { title: "ダッシュボード" };

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const now = nowMs();
  const d = buildDashboard(now);
  const k = d.kpis;

  return (
    <>
      <PageHeader
        icon="gauge"
        title="ダッシュボード"
        description={`${admin.nickname}さん、おつかれさまです。本日の運営状況です（${formatDateTime(d.generatedAt)} 時点）。`}
        actions={
          <>
            <ButtonLink href="/admin/gachas/new" size="sm" leftIcon="plus">
              ガチャを作成
            </ButtonLink>
            <ButtonLink href="/admin/orders" size="sm" variant="secondary" leftIcon="truck">
              発送管理{k.pendingOrders > 0 ? `（${k.pendingOrders}）` : ""}
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="総会員数" value={formatNumber(k.members)} sub={`本日の新規 +${formatNumber(k.newToday)}名`} icon="users" tone="primary" />
        <StatCard label="本日のアクティブ会員" value={formatNumber(k.activeToday)} sub="付与・消費があった会員" icon="activity" tone="info" />
        <StatCard label="本日の抽選" value={`${formatNumber(k.slotsToday)}口`} sub={`${formatNumber(k.drawRequestsToday)}リクエスト（1・10・100回）`} icon="capsule" tone="success" />
        <StatCard label="未発送の注文" value={`${formatNumber(k.pendingOrders)}件`} sub={<Link href="/admin/orders" className="font-bold text-primary hover:underline">発送管理へ →</Link>} icon="truck" tone={k.pendingOrders > 0 ? "warning" : "success"} />
        <StatCard label="本日のチケット付与" value={`${formatNumber(k.ticketsGrantedToday)}枚`} sub="ログイン・動画・案件など" icon="ticket" tone="ticket" />
        <StatCard label="本日のチケット消費" value={`${formatNumber(k.ticketsSpentToday)}枚`} sub="ガチャで使用" icon="flame" tone="danger" />
        <StatCard label="本日のポイント付与" value={`${formatNumber(k.pointsGrantedToday)}pt`} sub="ガチャ当選・クーポン" icon="coin" tone="point" />
        <StatCard label="本日のポイント交換" value={`${formatNumber(k.pointsExchangedToday)}pt`} sub={`公開中のガチャ ${k.activeGachas}件`} icon="gift" tone="primary" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon="chart" title="抽選口数（直近7日）" description="1日に引かれたガチャの口数" />
          <CardBody>
            <BarChart labels={d.days.map((x) => x.label)} series={[{ key: "slots", label: "抽選口数", color: "var(--primary)", values: d.days.map((x) => x.slots) }]} unit="口" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon="ticket" title="チケットの付与と消費（直近7日）" description="付与（ログイン・動画・案件）と消費（ガチャ）のバランス" />
          <CardBody>
            <BarChart
              labels={d.days.map((x) => x.label)}
              series={[
                { key: "granted", label: "付与", color: "var(--ticket)", values: d.days.map((x) => x.ticketsGranted) },
                { key: "spent", label: "消費", color: "#f97316", values: d.days.map((x) => x.ticketsSpent) },
              ]}
              unit="枚"
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader icon="capsule" title="ガチャの販売状況" actions={<ButtonLink href="/admin/gachas" size="xs" variant="secondary">管理</ButtonLink>} />
          <ul className="divide-y divide-line">
            {d.gachas.map((g) => (
              <li key={g.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/admin/gachas/${g.id}`} className="min-w-0 truncate text-sm font-bold hover:underline">
                    {g.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    <span>本日 {formatNumber(g.slotsToday)}口</span>
                    <Badge tone={g.status === "active" ? "success" : g.status === "soldout" ? "danger" : "warning"} size="xs">
                      {GACHA_STATUS_LABELS[g.status as keyof typeof GACHA_STATUS_LABELS]}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={g.remainingSlots} max={g.totalSlots} size="sm" tone={g.remainingSlots / g.totalSlots < 0.01 ? "gold" : "primary"} />
                  <span className="tabular w-40 shrink-0 text-right text-xs">
                    残り {formatNumber(g.remainingSlots)} / {formatNumber(g.totalSlots)}
                  </span>
                </div>
                {g.lastOneWinner && (
                  <p className="mt-1 text-xs text-muted">
                    <Icon name="crown" size={12} filled className="mr-1 inline text-accent" />
                    ラストワン賞: {g.lastOneWinner}さん
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon="sliders" title="本日のチケット付与の内訳" actions={<ButtonLink href="/admin/rewards" size="xs" variant="secondary">付与設定</ButtonLink>} />
          <CardBody>
            <HBarList items={d.grantBreakdownToday.map((g) => ({ key: g.key, label: g.label, value: g.tickets }))} color="var(--ticket)" unit="枚" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader icon="trophy" title="最近の大当たり" />
          {d.bigWins.length === 0 ? (
            <EmptyState icon="trophy" title="まだありません" className="py-8" />
          ) : (
            <ul className="divide-y divide-line">
              {d.bigWins.map((w) => (
                <li key={w.drawId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <RankBadge name={w.isLastOne ? "ラストワン" : w.rankName} color={w.rankColor} size="xs" />
                  <span className="min-w-0 flex-1 truncate">
                    {w.nickname}さん「{w.prizeName}」
                  </span>
                  <span className="shrink-0 text-xs text-subtle">{formatRelative(w.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader icon="signal" title="最近の成果通知" actions={<ButtonLink href="/admin/postbacks" size="xs" variant="secondary">ログ</ButtonLink>} />
          <ul className="divide-y divide-line">
            {d.postbacks.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Icon name={p.kind === "video" ? "tv" : "smartphone"} size={15} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">
                  {p.provider} {p.ticketsGranted > 0 ? `+${p.ticketsGranted}枚` : ""}
                </span>
                <Badge tone={p.status === "granted" ? "success" : p.status === "duplicate" || p.status === "limit_reached" ? "warning" : "danger"} size="xs">
                  {POSTBACK_STATUS_LABELS[p.status]}
                </Badge>
                <span className="w-14 shrink-0 text-right text-xs text-subtle">{formatRelative(p.receivedAt, now)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon="history" title="最近の管理操作" actions={<ButtonLink href="/admin/settings#audit" size="xs" variant="secondary">すべて</ButtonLink>} />
          <ul className="divide-y divide-line">
            {d.audits.map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-sm">
                <p className="truncate">
                  <span className="font-bold">{a.action}</span> <span className="text-muted">{a.target}</span>
                </p>
                <p className="text-xs text-subtle">
                  {a.actorName} ・ {formatRelative(a.createdAt, now)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
