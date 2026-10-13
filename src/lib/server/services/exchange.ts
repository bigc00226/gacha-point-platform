import "server-only";
import type { Balances } from "@/lib/api-types";
import type { ExchangeItem, Order, User, UserPrize } from "@/lib/types";
import { formatNumber, formatPoints } from "@/lib/format";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { generateGiftCode, newId } from "../ids";
import { changePoints } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { getDb } from "../store";
import { validationFail, vAddress, vBool, vInt, vOneOf, vOptionalUrl, vString } from "../validate";

// ---------------------------------------------------------------------------
// Member side: point exchange & prize shipping requests
// ---------------------------------------------------------------------------

export function listExchangeItems(): ExchangeItem[] {
  return [...getDb().exchangeItems.values()].filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getExchangeItem(id: string): ExchangeItem | null {
  const item = getDb().exchangeItems.get(id);
  return item && item.active ? item : null;
}

export interface ExchangeResultDto {
  order: Order;
  balances: Balances;
}

/** POST /api/exchange — deducts points, decrements stock and creates the order atomically. */
export async function exchangeItem(userId: string, body: Record<string, unknown>): Promise<ExchangeResultDto> {
  const itemId = vString(body.itemId, "itemId", "景品");
  return withLocks([lockKeys.exchangeItem(itemId), lockKeys.user(userId)], () => {
    const db = getDb();
    const item = db.exchangeItems.get(itemId);
    const user = db.users.get(userId);
    if (!item || !item.active) throw new ApiError(404, "NOT_FOUND", "この景品は現在交換できません");
    if (!user || user.status !== "active") throw new ApiError(403, "USER_SUSPENDED", "このアカウントではご利用いただけません");
    if (item.stock <= 0) throw new ApiError(409, "OUT_OF_STOCK", "申し訳ありません。この景品は在庫切れになりました");
    if (user.points < item.pointsRequired) {
      throw new ApiError(400, "INSUFFICIENT_POINTS", `ポイントが${formatPoints(item.pointsRequired - user.points)}不足しています`, {
        required: item.pointsRequired,
        balance: user.points,
      });
    }
    const address = item.type === "physical" ? vAddress(body.address) : null;
    const now = new Date().toISOString();
    const order: Order = {
      id: newId("od"),
      userId,
      userNickname: user.nickname,
      source: "exchange",
      refId: item.id,
      itemName: item.name,
      imageUrl: item.imageUrl,
      itemType: item.type,
      pointsSpent: item.pointsRequired,
      address,
      // Digital items are issued immediately; physical items wait for shipping.
      status: item.type === "digital" ? "shipped" : "pending",
      trackingNumber: null,
      digitalCode: item.type === "digital" ? generateGiftCode() : null,
      adminNote: "",
      createdAt: now,
      updatedAt: now,
      shippedAt: item.type === "digital" ? now : null,
    };
    changePoints(db, user, -item.pointsRequired, "exchange", `ポイント交換: ${item.name}`, order.id, now);
    item.stock -= 1;
    item.updatedAt = now;
    db.orders.set(order.id, order);
    if (address && body.saveAddress !== false) user.lastAddress = address;
    return { order, balances: { tickets: user.tickets, points: user.points } };
  });
}

/** POST /api/prizes/[id]/ship — a member asks for a physical gacha prize to be shipped. */
export async function requestPrizeShipping(userId: string, prizeId: string, body: Record<string, unknown>): Promise<{ order: Order; prize: UserPrize }> {
  return withLocks([lockKeys.userPrize(prizeId), lockKeys.user(userId)], () => {
    const db = getDb();
    const prize = db.userPrizes.get(prizeId);
    const user = db.users.get(userId);
    if (!prize || prize.userId !== userId || !user) throw new ApiError(404, "NOT_FOUND", "景品が見つかりません");
    if (prize.type !== "physical") throw new ApiError(400, "NOT_PHYSICAL", "デジタル特典は発送の手続きは不要です");
    if (prize.status !== "owned") throw new ApiError(409, "ALREADY_REQUESTED", "この景品は既に発送を依頼済みです");
    const address = vAddress(body.address);
    const now = new Date().toISOString();
    const order: Order = {
      id: newId("od"),
      userId,
      userNickname: user.nickname,
      source: "gacha_prize",
      refId: prize.id,
      itemName: prize.isLastOne ? `【ラストワン賞】${prize.name}` : prize.name,
      imageUrl: prize.imageUrl,
      itemType: "physical",
      pointsSpent: 0,
      address,
      status: "pending",
      trackingNumber: null,
      digitalCode: null,
      adminNote: "",
      createdAt: now,
      updatedAt: now,
      shippedAt: null,
    };
    db.orders.set(order.id, order);
    prize.status = "shipping_requested";
    prize.orderId = order.id;
    user.lastAddress = address;
    return { order, prize };
  });
}

// ---------------------------------------------------------------------------
// Admin: exchange items
// ---------------------------------------------------------------------------

export interface AdminExchangeItemDto extends ExchangeItem {
  orderCount: number;
  pendingCount: number;
}

export function listExchangeItemsAdmin(): AdminExchangeItemDto[] {
  const db = getDb();
  const counts = new Map<string, { all: number; pending: number }>();
  for (const o of db.orders.values()) {
    if (o.source !== "exchange") continue;
    const c = counts.get(o.refId) ?? { all: 0, pending: 0 };
    c.all += 1;
    if (o.status === "pending") c.pending += 1;
    counts.set(o.refId, c);
  }
  return [...db.exchangeItems.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ ...i, orderCount: counts.get(i.id)?.all ?? 0, pendingCount: counts.get(i.id)?.pending ?? 0 }));
}

function parseItemInput(body: Record<string, unknown>) {
  return {
    name: vString(body.name, "name", "景品名", { max: 60 }),
    description: vString(body.description, "description", "説明", { optional: true, max: 300 }),
    imageUrl: vOptionalUrl(body.imageUrl, "imageUrl", "画像"),
    pointsRequired: vInt(body.pointsRequired, "pointsRequired", "必要ポイント", { min: 1, max: 10_000_000 }),
    stock: vInt(body.stock, "stock", "在庫数", { min: 0, max: 1_000_000 }),
    type: vOneOf(body.type, "type", "種類", ["physical", "digital"] as const),
    active: vBool(body.active ?? true, "active", "公開"),
    sortOrder: vInt(body.sortOrder ?? 0, "sortOrder", "表示順", { min: -1000, max: 100_000 }),
  };
}

export async function createExchangeItem(admin: User, body: Record<string, unknown>): Promise<ExchangeItem> {
  const input = parseItemInput(body);
  const id = newId("ex");
  return withLocks([lockKeys.exchangeItem(id)], () => {
    const db = getDb();
    const now = new Date().toISOString();
    const item: ExchangeItem = { id, ...input, createdAt: now, updatedAt: now };
    db.exchangeItems.set(id, item);
    recordAudit(db, admin, "交換景品を追加", item.name, `${formatPoints(item.pointsRequired)} / 在庫${formatNumber(item.stock)}`);
    return item;
  });
}

export async function updateExchangeItem(admin: User, id: string, body: Record<string, unknown>): Promise<ExchangeItem> {
  const input = parseItemInput(body);
  return withLocks([lockKeys.exchangeItem(id)], () => {
    const db = getDb();
    const item = db.exchangeItems.get(id);
    if (!item) throw new ApiError(404, "NOT_FOUND", "景品が見つかりません");
    const notes: string[] = [];
    if (item.stock !== input.stock) notes.push(`在庫 ${formatNumber(item.stock)} → ${formatNumber(input.stock)}`);
    if (item.pointsRequired !== input.pointsRequired) notes.push(`必要ポイント ${formatPoints(item.pointsRequired)} → ${formatPoints(input.pointsRequired)}`);
    if (item.active !== input.active) notes.push(input.active ? "公開" : "非公開");
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    recordAudit(db, admin, "交換景品を更新", item.name, notes.join(" / ") || "内容を更新");
    return item;
  });
}

export async function deleteExchangeItem(admin: User, id: string): Promise<void> {
  await withLocks([lockKeys.exchangeItem(id)], () => {
    const db = getDb();
    const item = db.exchangeItems.get(id);
    if (!item) throw new ApiError(404, "NOT_FOUND", "景品が見つかりません");
    const used = [...db.orders.values()].some((o) => o.source === "exchange" && o.refId === id);
    if (used) throw new ApiError(409, "ITEM_HAS_ORDERS", "交換実績のある景品は削除できません。「非公開」にしてください");
    db.exchangeItems.delete(id);
    recordAudit(db, admin, "交換景品を削除", item.name);
  });
}

// ---------------------------------------------------------------------------
// Admin: orders (発送管理)
// ---------------------------------------------------------------------------

export interface AdminOrderDto extends Order {
  userEmail: string;
}

export interface OrderKpisDto {
  pending: number;
  todayRequests: number;
  shippedThisWeek: number;
  total: number;
}

export function listOrdersAdmin(): { orders: AdminOrderDto[]; kpis: OrderKpisDto } {
  const db = getDb();
  const now = Date.now();
  const todayStart = new Date(now - ((now + 9 * 3600_000) % 86_400_000)).toISOString();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const orders = [...db.orders.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o, userEmail: db.users.get(o.userId)?.email ?? "" }));
  return {
    orders,
    kpis: {
      pending: orders.filter((o) => o.status === "pending").length,
      todayRequests: orders.filter((o) => o.createdAt >= todayStart).length,
      shippedThisWeek: orders.filter((o) => o.status === "shipped" && (o.shippedAt ?? "") >= weekAgo).length,
      total: orders.length,
    },
  };
}

function shipOrder(admin: User, order: Order, trackingNumber: string | null, note: string | null): void {
  const db = getDb();
  if (order.status !== "pending") throw new ApiError(409, "INVALID_STATUS", "未発送の注文のみ発送済にできます");
  const now = new Date().toISOString();
  order.status = "shipped";
  order.shippedAt = now;
  order.updatedAt = now;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (note !== null) order.adminNote = note;
  if (order.itemType === "digital" && !order.digitalCode) order.digitalCode = generateGiftCode();
  if (order.source === "gacha_prize") {
    const prize = db.userPrizes.get(order.refId);
    if (prize) prize.status = "shipped";
  }
  recordAudit(db, admin, "発送ステータスを更新", order.itemName, `${order.userNickname}さん / 発送済${trackingNumber ? `（追跡番号 ${trackingNumber}）` : ""}`);
}

export async function updateOrder(admin: User, id: string, body: Record<string, unknown>): Promise<AdminOrderDto> {
  const action = vOneOf(body.action, "action", "操作", ["ship", "cancel", "note"] as const);
  const trackingNumber = vString(body.trackingNumber, "trackingNumber", "追跡番号", { optional: true, max: 40 }) || null;
  const note = body.adminNote === undefined ? null : vString(body.adminNote, "adminNote", "メモ", { optional: true, max: 300 });
  const db0 = getDb();
  const peek = db0.orders.get(id);
  if (!peek) throw new ApiError(404, "NOT_FOUND", "注文が見つかりません");
  const keys = [lockKeys.order(id), lockKeys.user(peek.userId)];
  if (peek.source === "exchange") keys.push(lockKeys.exchangeItem(peek.refId));
  else keys.push(lockKeys.userPrize(peek.refId));

  return withLocks(keys, () => {
    const db = getDb();
    const order = db.orders.get(id);
    if (!order) throw new ApiError(404, "NOT_FOUND", "注文が見つかりません");
    if (action === "ship") {
      shipOrder(admin, order, trackingNumber, note);
    } else if (action === "cancel") {
      if (order.status !== "pending") throw new ApiError(409, "INVALID_STATUS", "未発送の注文のみキャンセルできます");
      const now = new Date().toISOString();
      if (order.source === "exchange") {
        const user = db.users.get(order.userId);
        if (user && order.pointsSpent > 0) {
          changePoints(db, user, order.pointsSpent, "exchange_refund", `交換キャンセル（返還）: ${order.itemName}`, order.id, now);
        }
        const item = db.exchangeItems.get(order.refId);
        if (item) item.stock += 1;
      } else {
        const prize = db.userPrizes.get(order.refId);
        if (prize) {
          prize.status = "owned";
          prize.orderId = null;
        }
      }
      order.status = "cancelled";
      order.updatedAt = now;
      if (note !== null) order.adminNote = note;
      recordAudit(db, admin, "注文をキャンセル", order.itemName, `${order.userNickname}さん${order.source === "exchange" ? ` / ${formatPoints(order.pointsSpent)}を返還` : " / 景品を未申請に戻す"}`);
    } else {
      order.adminNote = note ?? "";
      order.updatedAt = new Date().toISOString();
    }
    return { ...order, userEmail: db.users.get(order.userId)?.email ?? "" };
  });
}

export async function bulkShip(admin: User, ids: unknown): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((x) => typeof x !== "string")) validationFail("ids", "注文を選択してください");
  let shipped = 0;
  for (const id of ids as string[]) {
    const order = getDb().orders.get(id);
    if (!order || order.status !== "pending") continue;
    await withLocks([lockKeys.order(id), lockKeys.user(order.userId), lockKeys.userPrize(order.refId)], () => {
      const current = getDb().orders.get(id);
      if (current && current.status === "pending") {
        shipOrder(admin, current, null, null);
        shipped += 1;
      }
    });
  }
  return shipped;
}
