"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon="alert"
      title="画面の表示中にエラーが発生しました"
      description={error.message || "時間をおいて再度お試しください。"}
      action={
        <Button variant="secondary" leftIcon="refresh" onClick={reset}>
          再試行
        </Button>
      }
    />
  );
}
