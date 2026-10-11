"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/actions";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial?: { topic: string | null; text: string; referenceAnswer: string };
  submitLabel: string;
  sections?: string[];
};

export default function QuestionForm({ action, initial, submitLabel, sections = [] }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message && !initial) formRef.current?.reset();
  }, [state, initial]);

  return (
    <form ref={formRef} onSubmit={(e) => {
        // Submit manually so React does not reset the fields when the action returns an error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }} className="space-y-3">
      <input name="topic" list="sections-list" placeholder="Раздел (необязательно), например: JavaScript" defaultValue={initial?.topic ?? ""} className="input" autoComplete="off" />
      <datalist id="sections-list">
        {sections.map((s) => <option key={s} value={s} />)}
      </datalist>
      <textarea name="text" required rows={2} placeholder="Вопрос" defaultValue={initial?.text} className="input" />
      <textarea name="referenceAnswer" required rows={5} placeholder="Эталонный ответ" defaultValue={initial?.referenceAnswer} className="input" />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Сохраняю…" : submitLabel}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.message && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
    </form>
  );
}
