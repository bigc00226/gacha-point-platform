/** Number / currency formatting shared by server and client. */

const numberFmt = new Intl.NumberFormat("ja-JP");

/** 1234567 → "1,234,567" */
export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

/** 1234 → "+1,234" / -50 → "-50" */
export function formatSigned(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "-" : "±"}${numberFmt.format(Math.abs(value))}`;
}

/** ガチャチケット: 1234 → "1,234枚" */
export function formatTickets(value: number): string {
  return `${numberFmt.format(value)}枚`;
}

/** ポイント: 1234 → "1,234pt" */
export function formatPoints(value: number): string {
  return `${numberFmt.format(value)}pt`;
}

/** 口数: 1234 → "1,234口" */
export function formatSlots(value: number): string {
  return `${numberFmt.format(value)}口`;
}

/** ratio 0.1234 → "12.3%" */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 1536 → "1.5 KB" */
export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** 0.84 → "0.84ms", 1530 → "1.53秒" */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}秒`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Join class names, skipping anything that is not a non-empty string (false, null, 0 ...). */
export function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === "string" && c.length > 0).join(" ");
}
