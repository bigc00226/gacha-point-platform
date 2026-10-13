import "server-only";
import type { PublicUser, User } from "@/lib/types";

/** Strip secrets before sending a user to the browser. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    tickets: user.tickets,
    points: user.points,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
