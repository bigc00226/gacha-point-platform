import "server-only";
import { ApiError } from "./http";

/**
 * Demo-only helpers (quick top-ups, data reset, ad-network simulators ...).
 * Set DEMO_TOOLS_ENABLED=false to switch every demo endpoint off.
 */
export function demoToolsEnabled(): boolean {
  return process.env.DEMO_TOOLS_ENABLED !== "false";
}

export function assertDemoToolsEnabled(): void {
  if (!demoToolsEnabled()) throw new ApiError(404, "NOT_FOUND", "この機能は無効になっています");
}
