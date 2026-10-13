import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function GachaNotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon="capsule"
        title="ガチャが見つかりません"
        description="このガチャは公開が終了したか、URLが間違っている可能性があります。"
        action={
          <ButtonLink href="/" leftIcon="arrowLeft">
            ガチャ一覧へ戻る
          </ButtonLink>
        }
      />
    </div>
  );
}
