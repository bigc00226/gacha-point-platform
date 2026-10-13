import { getLoginBonusStatus } from "@/lib/server/services/rewards";
import { getDb } from "@/lib/server/store";
import { LoginBonusModal } from "./login-bonus-modal";

/**
 * Server component rendered by the site layout for signed-in users. When today's
 * login bonus (JST) is still unclaimed it renders the celebratory modal, which opens
 * automatically once per day and lets the user claim it (POST /api/rewards/login-bonus).
 */
export async function LoginBonusPrompt({ userId }: { userId: string }) {
  const user = getDb().users.get(userId);
  if (!user || user.status !== "active") return null;
  const status = getLoginBonusStatus(user);
  if (status.claimedToday || status.tickets <= 0) return null;
  return (
    <LoginBonusModal
      userId={user.id}
      todayKey={status.todayKey}
      tickets={status.tickets}
      nextStreak={status.nextStreak}
    />
  );
}
