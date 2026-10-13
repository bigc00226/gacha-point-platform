import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** Shown to signed-out visitors. */
export function RegisterCta({ bonus }: { bonus: number }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-r from-primary/15 via-surface to-ticket/10 p-5 sm:p-6">
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary to-primary-2 text-white shadow-lg shadow-primary/30">
            <Icon name="gift" size={24} />
          </span>
          <div>
            <p className="text-base font-black text-fg sm:text-lg">
              無料会員登録で <span className="text-ticket">ガチャチケット{bonus}枚</span> プレゼント！
            </p>
            <p className="mt-0.5 text-xs text-muted">メールアドレスだけで30秒で登録できます。</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/register" size="lg" className="flex-1 sm:flex-none">
            無料で登録
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg" className="flex-1 sm:flex-none">
            ログイン
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
