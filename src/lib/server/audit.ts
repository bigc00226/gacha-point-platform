import "server-only";
import type { User } from "@/lib/types";
import { newId } from "./ids";
import type { Db } from "./store";

const MAX_AUDIT_LOGS = 1000;

/** Records an admin operation (shown on the dashboard / settings page). */
export function recordAudit(
  db: Db,
  actor: Pick<User, "id" | "nickname">,
  action: string,
  target: string,
  detail = "",
): void {
  db.auditLogs.push({
    id: newId("au"),
    actorId: actor.id,
    actorName: actor.nickname,
    action,
    target,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > MAX_AUDIT_LOGS) db.auditLogs.splice(0, db.auditLogs.length - MAX_AUDIT_LOGS);
}
