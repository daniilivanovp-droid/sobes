import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createQuestion, deleteQuestion, startPractice } from "@/lib/actions";
import QuestionForm from "@/components/QuestionForm";
import ImportForm from "@/components/ImportForm";
import NotionSync from "@/components/NotionSync";
import { notionConfigured } from "@/lib/notion";
import { scoreColor } from "@/lib/format";
import { listSections, NO_SECTION, sectionFilter } from "@/lib/practice";

const sectionTitle = (name: string) => (name === NO_SECTION ? "Без раздела" : name);

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const user = await requireUser();
  const sections = await listSections(user.id);
  const { section } = await searchParams;
  const active = section !== undefined && sections.some((s) => s.name === section) ? section : undefined;

  const questions = await db.question.findMany({
    where: { userId: user.id, ...(active !== undefined ? sectionFilter([active]) : {}) },
    orderBy: { createdAt: "desc" },
    include: { attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { score: true } }, _count: { select: { attempts: true } } },
  });
  const total = sections.reduce((n, s) => n + s.count, 0);

  // Group the list by section, in the same order as the section chips.
  const groups = sections
    .filter((s) => active === undefined || s.name === active)
    .map((s) => ({ ...s, items: questions.filter((q) => (q.topic ?? NO_SECTION) === s.name) }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Мои вопросы <span className="text-slate-400">{total}</span></h1>
        {total > 0 && <Link href="/practice" className="btn-primary">Тренироваться</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Добавить вопрос</h2>
          <QuestionForm
            action={createQuestion}
            submitLabel="Добавить"
            sections={sections.map((s) => s.name).filter((n) => n !== NO_SECTION)}
          />
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Загрузить списком</h2>
          <ImportForm />
        </section>
      </div>

      {notionConfigured() && (
        <section className="card mt-6">
          <h2 className="mb-3 font-semibold">Notion</h2>
          <NotionSync />
        </section>
      )}

      {sections.length > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2 text-sm">
          <Link href="/questions" className={chip(active === undefined)}>Все <span className="opacity-60">{total}</span></Link>
          {sections.map((s) => (
            <Link key={s.name} href={`/questions?section=${encodeURIComponent(s.name)}`} className={chip(active === s.name)}>
              {sectionTitle(s.name)} <span className="opacity-60">{s.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {total === 0 && (
        <p className="card mt-8 text-center text-slate-500">Пока нет вопросов. Добавьте первый или загрузите список.</p>
      )}

      {groups.map((g) => (
        <section key={g.name} className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold">{sectionTitle(g.name)}</h2>
            <span className="text-sm text-slate-400">{g.count}</span>
            <form action={startPractice} className="ml-auto">
              <input type="hidden" name="section" value={g.name} />
              <input type="hidden" name="total" value={sections.length} />
              <button className="btn-secondary">Тренировать раздел</button>
            </form>
          </div>
          <ul className="space-y-3">
            {g.items.map((q) => {
              const last = q.attempts[0]?.score;
              return (
                <li key={q.id} className="card">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.text}</p>
                      <details className="mt-1 text-sm text-slate-600">
                        <summary className="cursor-pointer text-slate-500">Эталонный ответ</summary>
                        <p className="mt-2 whitespace-pre-wrap">{q.referenceAnswer}</p>
                      </details>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {last !== undefined && (
                        <span className={`rounded px-2 py-1 font-semibold ${scoreColor(last)}`} title={`Попыток: ${q._count.attempts}`}>{last}/10</span>
                      )}
                      <Link href={`/practice/${q.id}`} className="btn-primary">Ответить</Link>
                      <Link href={`/questions/${q.id}/edit`} className="btn-secondary">Изменить</Link>
                      <form action={deleteQuestion}>
                        <input type="hidden" name="id" value={q.id} />
                        <button className="btn-secondary text-red-600">Удалить</button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-full border px-3 py-1 ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;
}
