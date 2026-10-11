import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { startPractice } from "@/lib/actions";
import { getPracticeSections, listSections, NO_SECTION } from "@/lib/practice";

export default async function PracticePage() {
  const user = await requireUser();
  const sections = await listSections(user.id);

  if (!sections.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Нет вопросов для тренировки</h1>
        <p className="mt-3 text-slate-600">Сначала добавьте вопросы с эталонными ответами.</p>
        <Link href="/questions" className="btn-primary mt-6 inline-block">Добавить вопросы</Link>
      </div>
    );
  }

  const saved = await getPracticeSections();
  const isChecked = (name: string) => !saved.length || saved.includes(name);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Тренировка</h1>
      <p className="mt-2 text-slate-600">Выберите разделы, по которым хотите отвечать. Вопросы будут идти по кругу.</p>
      <form action={startPractice} className="card mt-6 space-y-3">
        <input type="hidden" name="total" value={sections.length} />
        {sections.map((s) => (
          <label key={s.name} className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="section" value={s.name} defaultChecked={isChecked(s.name)} className="h-4 w-4 accent-indigo-600" />
            <span className="flex-1">{s.name === NO_SECTION ? <span className="text-slate-500">Без раздела</span> : s.name}</span>
            <span className="text-sm text-slate-400">{s.count}</span>
          </label>
        ))}
        <button className="btn-primary mt-2 w-full">Начать</button>
      </form>
    </div>
  );
}
