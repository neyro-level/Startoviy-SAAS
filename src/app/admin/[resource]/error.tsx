"use client";

import { Button } from "../../../components/ui/button.tsx";
import { ErrorState } from "../../../components/states/StatePanel.tsx";

export default function AdminResourceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = error.digest;
  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <ErrorState
        title="Не удалось загрузить раздел администрирования"
        description={reference
          ? `Повторите запрос. Если ошибка сохранится, передайте код обращения ${reference}.`
          : "Повторите запрос. Если ошибка сохранится, обратитесь в поддержку."}
        action={<Button onClick={reset} type="button">Повторить</Button>}
      />
    </div>
  );
}
