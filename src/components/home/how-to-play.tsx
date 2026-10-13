import { Icon, type IconName } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/misc";

const STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "ticket",
    title: "チケットを貯める",
    body: "ログインボーナス・動画視聴・アンケートやアプリ導入などの案件で、ガチャチケットが無料で貯まります。",
  },
  {
    icon: "capsule",
    title: "ガチャを引く",
    body: "1回・10回・100回をワンタップで。当選ランクに応じた演出のあと、結果がすぐに表示されます（スキップも可能）。",
  },
  {
    icon: "gift",
    title: "景品と交換",
    body: "当たったポイントは景品と交換。実物景品はマイページから発送を依頼でき、発送状況も確認できます。",
  },
];

export function HowToPlay() {
  return (
    <section aria-labelledby="howto-heading">
      <SectionTitle title="あそびかた" subtitle="3ステップでかんたん" icon="help" />
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5">
            <span className="pointer-events-none absolute -right-2 -top-6 font-display text-[88px] leading-none text-white/[0.04]" aria-hidden="true">
              {i + 1}
            </span>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-3 text-primary">
                <Icon name={step.icon} size={20} />
              </span>
              <p className="text-xs font-black tracking-wider text-subtle">STEP {i + 1}</p>
            </div>
            <h3 className="mt-3 text-base font-black text-fg">{step.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
