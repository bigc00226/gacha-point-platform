import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./icon";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "gold" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-primary to-primary-2 text-primary-fg shadow-lg shadow-primary/25 hover:brightness-110",
  gold:
    "bg-linear-to-b from-[#fff1a8] via-[#ffc93d] to-[#f0960e] text-[#3a2100] shadow-lg shadow-[#ffb800]/25 hover:brightness-105",
  secondary: "border border-line bg-surface-2 text-fg hover:bg-surface-3",
  outline: "border border-line-strong bg-transparent text-fg hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white shadow-sm hover:brightness-110",
  success: "bg-success text-white shadow-sm hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 gap-1 rounded-lg px-2.5 text-xs",
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-base",
  xl: "h-14 gap-2.5 rounded-2xl px-6 text-lg",
};

const ICON_SIZES: Record<ButtonSize, number> = { xs: 14, sm: 16, md: 18, lg: 20, xl: 22 };

/** Class names for anything that should look like a button (e.g. a file-input label). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", fullWidth = false) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-bold transition-[filter,background-color,color,transform,box-shadow] duration-150",
    "active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: IconName;
  rightIcon?: IconName;
  fullWidth?: boolean;
}

export interface ButtonProps extends ComponentProps<"button">, CommonProps {
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...props}
    >
      {loading ? (
        <Spinner size={ICON_SIZES[size] - 2} />
      ) : (
        leftIcon && <Icon name={leftIcon} size={ICON_SIZES[size]} />
      )}
      {children}
      {rightIcon && !loading && <Icon name={rightIcon} size={ICON_SIZES[size]} />}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, "children">, CommonProps {
  children?: ReactNode;
  disabled?: boolean;
}

/** A Next.js <Link> styled as a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth,
  disabled,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...props}
    >
      {leftIcon && <Icon name={leftIcon} size={ICON_SIZES[size]} />}
      {children}
      {rightIcon && <Icon name={rightIcon} size={ICON_SIZES[size]} />}
    </Link>
  );
}

/** Square icon-only button. Always pass `label` for screen readers. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: Omit<ButtonProps, "children" | "leftIcon" | "rightIcon"> & { icon: IconName; label: string }) {
  const square: Record<ButtonSize, string> = { xs: "w-7 px-0", sm: "w-9 px-0", md: "w-10 px-0", lg: "w-12 px-0", xl: "w-14 px-0" };
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} className={cn(square[size], className)} {...props}>
      <Icon name={icon} size={ICON_SIZES[size]} />
    </Button>
  );
}
