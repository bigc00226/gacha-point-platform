"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminUserRowDto } from "@/lib/server/services/admin-users";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type SortKey = "created" | "tickets" | "points" | "login" | "draws";

export function UsersTable({ users }: { users: AdminUserRowDto[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | "user" | "admin">("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [sort, setSort] = useState<SortKey>("created");

  const needle = q.trim().toLowerCase();
  const list = users
    .filter((u) => (!role || u.role === role) && (!status || u.status === status))
    .filter((u) => !needle || u.nickname.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.id.toLowerCase().includes(needle))
    .sort((a, b) => {
      switch (sort) {
        case "tickets":
          return b.tickets - a.tickets;
        case "points":
          return b.points - a.points;
        case "draws":
          return b.draws - a.draws;
        case "login":
          return (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? "");
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  const { pageItems, page, pageCount, setPage, total } = usePaged(list, 20);

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="検索" htmlFor="u-q">
          <Input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ニックネーム・メール・会員ID" />
        </Field>
        <Field label="権限" htmlFor="u-role">
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="">すべて</option>
            <option value="user">一般会員</option>
            <option value="admin">管理者</option>
          </Select>
        </Field>
        <Field label="状態" htmlFor="u-status">
          <Select id="u-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">すべて</option>
            <option value="active">利用中</option>
            <option value="suspended">利用停止</option>
          </Select>
        </Field>
        <Field label="並び順" htmlFor="u-sort">
          <Select id="u-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="created">登録日が新しい順</option>
            <option value="login">最終ログインが新しい順</option>
            <option value="tickets">チケットが多い順</option>
            <option value="points">ポイントが多い順</option>
            <option value="draws">ガチャ口数が多い順</option>
          </Select>
        </Field>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="users" title="該当する会員はいません" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>会員</TH>
              <TH>権限・状態</TH>
              <TH className="text-right">チケット</TH>
              <TH className="text-right">ポイント</TH>
              <TH className="text-right">ガチャ</TH>
              <TH>登録日時</TH>
              <TH>最終ログイン</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {pageItems.map((u) => (
              <TR key={u.id}>
                <TD mobile="title">
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-black text-primary">{u.nickname.slice(0, 1)}</span>
                    <span className="min-w-0">
                      <span className="block max-w-48 truncate font-bold">{u.nickname}</span>
                      <span className="block max-w-56 truncate text-xs text-muted">{u.email}</span>
                    </span>
                  </Link>
                </TD>
                <TD label="権限・状態">
                  <div className="flex flex-wrap gap-1 @max-4xl:justify-end">
                    {u.role === "admin" && <Badge tone="primary" icon="shield">管理者</Badge>}
                    <Badge tone={u.status === "active" ? "success" : "danger"}>{u.status === "active" ? "利用中" : "利用停止"}</Badge>
                  </div>
                </TD>
                <TD label="チケット" className="tabular text-right font-bold text-ticket">{formatNumber(u.tickets)}枚</TD>
                <TD label="ポイント" className="tabular text-right font-bold text-point">{formatNumber(u.points)}pt</TD>
                <TD label="ガチャ" className="tabular text-right text-sm">{formatNumber(u.draws)}口</TD>
                <TD label="登録日時" mobile="hide" className="whitespace-nowrap text-xs text-muted">{formatDateTime(u.createdAt)}</TD>
                <TD label="最終ログイン" className="whitespace-nowrap text-xs text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</TD>
                <TD mobile="hide">
                  <Link href={`/admin/users/${u.id}`} className="text-subtle hover:text-fg" aria-label="詳細">
                    <Icon name="chevronRight" size={18} />
                  </Link>
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
  );
}
