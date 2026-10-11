"use client";

import { useActionState } from "react";
import { syncNotion, type FormState } from "@/lib/actions";

export default function NotionSync() {
  const [state, action, pending] = useActionState<FormState, FormData>(syncNotion, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Читаю Notion…" : "Синхронизировать с Notion"}</button>
        <span className="text-sm text-slate-500">Новые вопросы добавятся, изменённые обновятся. Разделы берутся из заголовков страницы.</span>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
