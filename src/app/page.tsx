import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const steps = [
  { title: "Загрузите вопросы", text: "Добавьте вопросы и эталонные ответы по одному или списком из файла." },
  { title: "Отвечайте как на собеседовании", text: "Печатайте ответ или надиктуйте его голосом, без подглядывания в эталон." },
  { title: "Получите оценку", text: "Ответ сравнивается с эталоном: балл из 10, что было хорошо, что упущено и где ошибки." },
];

const features = [
  ["Голосовой ввод", "Тренируйтесь говорить вслух, как на настоящем интервью. Речь распознаётся прямо в браузере."],
  ["Оценка по смыслу", "ИИ-интервьюер сравнивает ответ с эталоном по сути, а не по совпадению слов, и задаёт уточняющий вопрос."],
  ["Свои вопросы", "Каждый пользователь работает со своей базой вопросов: по темам, компаниям или конкретной вакансии."],
  ["История попыток", "Видно, как меняется оценка по каждому вопросу, и что стоит повторить ещё раз."],
];

export default async function Home() {
  const user = await getCurrentUser();
  const cta = user ? { href: "/practice", label: "Начать тренировку" } : { href: "/register", label: "Начать бесплатно" };
  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Репетиция собеседования, <span className="text-indigo-600">которая ставит оценку</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Загрузите свои вопросы с эталонными ответами, отвечайте текстом или голосом и получайте разбор,
          как от настоящего интервьюера. Быстрая подготовка и повторение материала перед собеседованием.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={cta.href} className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">{cta.label}</Link>
          {!user && <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium hover:bg-slate-50">Уже есть аккаунт</Link>}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-semibold">Как это работает</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-slate-200 p-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">{i + 1}</div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold">Что внутри</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {features.map(([title, text]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="rounded-2xl bg-indigo-600 px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-semibold">Пример оценки</h2>
          <div className="mx-auto mt-6 max-w-xl rounded-xl bg-white p-5 text-left text-slate-800">
            <p className="text-sm text-slate-500">Вопрос: Чем процесс отличается от потока?</p>
            <p className="mt-3 text-2xl font-bold">7 / 10 <span className="text-base font-medium text-indigo-600">· Хорошо</span></p>
            <p className="mt-2 text-sm">Суть изложена верно, но не прозвучало, что потоки разделяют общую память процесса.</p>
            <p className="mt-2 text-sm text-slate-500">Уточняющий вопрос: какие проблемы возникают из-за общей памяти?</p>
          </div>
          <Link href={cta.href} className="mt-8 inline-block rounded-lg bg-white px-5 py-3 font-medium text-indigo-700 hover:bg-indigo-50">{cta.label}</Link>
        </div>
      </section>
    </div>
  );
}
