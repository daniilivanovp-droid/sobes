"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { FormState } from "@/lib/actions";

type Props = {
  mode: "login" | "register";
  action: (state: FormState, form: FormData) => Promise<FormState>;
  next?: string;
};

export default function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">{isLogin ? "Вход" : "Регистрация"}</h1>
      <form onSubmit={(e) => {
        // Submit manually so React does not reset the fields when the action returns an error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }} className="mt-6 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        {!isLogin && (
          <label className="block">
            <span className="text-sm text-slate-600">Имя</span>
            <input name="name" className="input" autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="text-sm text-slate-600">Email</span>
          <input name="email" type="email" required className="input" autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Пароль</span>
          <input name="password" type="password" required minLength={6} className="input" autoComplete={isLogin ? "current-password" : "new-password"} />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? "Подождите…" : isLogin ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
        <Link href={isLogin ? "/register" : "/login"} className="text-indigo-600 hover:underline">
          {isLogin ? "Зарегистрироваться" : "Войти"}
        </Link>
      </p>
    </div>
  );
}
