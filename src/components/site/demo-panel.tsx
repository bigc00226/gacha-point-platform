"use client";

import type { PublicUser } from "@/lib/types";

/**
 * STUB — implemented by the demo-tools module.
 * Floating "DEMO" button with shortcuts for evaluating the demo (quick login as
 * user/admin, add tickets/points, reset today's video count, jump to the
 * last-one gacha, reset demo data, open the guide).
 */
export function DemoPanel({ user }: { user: PublicUser | null }) {
  void user;
  return null;
}
