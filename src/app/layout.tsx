import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Собес.Тренер — подготовка к собеседованиям",
  description: "Загружайте вопросы с эталонными ответами, отвечайте текстом или голосом и получайте оценку как на реальном собеседовании.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ru">
      <body className={`${geist.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-semibold text-indigo-700">Собес.Тренер</Link>
            {user ? (
              <>
                <Link href="/questions" className="text-sm text-slate-600 hover:text-slate-900">Мои вопросы</Link>
                <Link href="/practice" className="text-sm text-slate-600 hover:text-slate-900">Тренировка</Link>
                <span className="ml-auto hidden text-sm text-slate-500 sm:inline">{user.name || user.email}</span>
                <form action={logout} className="ml-auto sm:ml-0">
                  <button className="text-sm text-slate-600 hover:text-slate-900">Выйти</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="ml-auto text-sm text-slate-600 hover:text-slate-900">Войти</Link>
                <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">Регистрация</Link>
              </>
            )}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Собес.Тренер · готовьтесь к собеседованиям быстрее
        </footer>
      </body>
    </html>
  );
}
