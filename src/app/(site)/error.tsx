"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon="alert"
      title="ページを表示できませんでした"
      description="一時的なエラーが発生しました。時間をおいて再度お試しください。"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon="refresh" onClick={reset}>
            再読み込み
          </Button>
          <ButtonLink href="/" variant="primary">
            トップへ
          </ButtonLink>
        </div>
      }
    />
  );
}
