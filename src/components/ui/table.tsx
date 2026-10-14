import type { ComponentProps } from "react";
import { cn } from "@/lib/format";

/**
 * Admin list table.
 *
 * The layout follows the space the table actually has (a container query on its
 * wrapper, so the admin sidebar is accounted for), not the viewport:
 *   - 56rem (896px) and wider: a regular table
 *   - narrower (phones, tablets, small laptops): every row becomes a card
 * Each cell picks how it shows in a card with `mobile` (and `label`, shown in
 * front of the value):
 *   - "row"   (default when `label` is set): "label ……… value" on one line
 *   - "stack": label above the value (long text)
 *   - "title": the card's heading (moved to the top), no label
 *   - "full":  full width, no label (default without `label`; actions, notes)
 *   - "hide":  not shown on phones (secondary columns)
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="@container w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm @max-4xl:block", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-2 text-xs font-bold text-muted @max-4xl:hidden", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line @max-4xl:block", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-2/60 @max-4xl:cv-auto @max-4xl:flex @max-4xl:flex-col @max-4xl:px-4 @max-4xl:py-3 @max-4xl:[--cv-size:200px]", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("whitespace-nowrap px-3 py-2.5 font-bold first:pl-4 last:pr-4", className)} {...props} />;
}

export type CellMobile = "row" | "stack" | "title" | "full" | "hide";

const MOBILE_CELL: Record<CellMobile, string> = {
  row: "@max-4xl:flex @max-4xl:items-center @max-4xl:justify-between @max-4xl:gap-4 @max-4xl:py-1 @max-4xl:text-right @max-4xl:before:shrink-0 @max-4xl:before:text-left",
  stack: "@max-4xl:block @max-4xl:py-1.5 @max-4xl:text-left @max-4xl:before:mb-0.5 @max-4xl:before:block",
  title: "@max-4xl:order-first @max-4xl:block @max-4xl:pb-2 @max-4xl:pt-0 @max-4xl:text-left",
  full: "@max-4xl:block @max-4xl:py-1 @max-4xl:text-left",
  hide: "@max-4xl:hidden",
};

export function TD({
  className,
  label,
  mobile,
  ...props
}: ComponentProps<"td"> & { label?: string; mobile?: CellMobile }) {
  const mode: CellMobile = mobile ?? (label ? "row" : "full");
  const showLabel = !!label && (mode === "row" || mode === "stack");
  return (
    <td
      data-label={showLabel ? label : undefined}
      className={cn(
        "px-3 py-3 align-middle text-fg first:pl-4 last:pr-4",
        // Phones: cells span the card; desktop column widths / no-wrap don't apply.
        "@max-4xl:max-w-none @max-4xl:whitespace-normal @max-4xl:px-0",
        MOBILE_CELL[mode],
        showLabel && "@max-4xl:before:text-xs @max-4xl:before:font-bold @max-4xl:before:text-muted @max-4xl:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}
