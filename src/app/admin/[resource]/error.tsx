"use client";

import { useMemo } from "react";
import { Button } from "../../../components/ui/button.tsx";
import { ErrorState } from "../../../components/states/StatePanel.tsx";

export default function AdminResourceError({ error, reset }: { error: Error; reset: () => void }) {
  const correlationId = useMemo(() => crypto.randomUUID(), []);
  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <ErrorState
        title="Не удалось загрузить раздел администрирования"
        description={`Повторите запрос. Если ошибка сохранится, передайте код обращения ${correlationId}.`}
        action={<Button onClick={reset} type="button">Повторить</Button>}
      />
      <p className="sr-only">{error.name}</p>
    </div>
  );
}
