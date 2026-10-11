"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { importQuestions, type FormState } from "@/lib/actions";

const EXAMPLE = `Чем let отличается от var?
let имеет блочную область видимости, var — функциональную. let не всплывает с инициализацией (временная мёртвая зона).
---
Что такое замыкание?
Функция вместе с лексическим окружением, в котором она была создана.`;

export default function ImportForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(importQuestions, {});
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) setText("");
  }, [state]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
    e.target.value = "";
  }

  return (
    <form ref={formRef} onSubmit={(e) => {
        // Submit manually so React does not reset the fields when the action returns an error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }} className="space-y-3">
      <p className="text-sm text-slate-600">
        Вставьте текст или загрузите .txt/.md файл. Вопросы разделяются строкой <code className="rounded bg-slate-100 px-1">---</code>;
        в каждом блоке первая строка это вопрос, остальное эталонный ответ.
      </p>
      <input name="topic" placeholder="Тема для всех вопросов (необязательно)" className="input" />
      <textarea name="bulk" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="input font-mono" />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !text.trim()} className="btn-primary">{pending ? "Загружаю…" : "Загрузить"}</button>
        <label className="btn-secondary cursor-pointer">
          Выбрать файл
          <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onFile} className="hidden" />
        </label>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.message && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
    </form>
  );
}
