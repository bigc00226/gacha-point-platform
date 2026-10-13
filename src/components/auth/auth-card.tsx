import type { ReactNode } from "react";
import { LogoMark } from "@/components/site/logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-8">
      <div className="relative">
        <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-br from-primary/20 via-transparent to-ticket/15 blur-2xl" />
        <div className="rounded-3xl border border-line bg-surface/95 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark size={52} className="animate-float" />
            <h1 className="mt-3 font-display text-2xl text-fg">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
