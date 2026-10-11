import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createQuestion, deleteQuestion } from "@/lib/actions";
import QuestionForm from "@/components/QuestionForm";
import ImportForm from "@/components/ImportForm";
import { scoreColor } from "@/lib/format";

export default async function QuestionsPage() {
  const user = await requireUser();
  const questions = await db.question.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { score: true } }, _count: { select: { attempts: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Мои вопросы <span className="text-slate-400">{questions.length}</span></h1>
        {questions.length > 0 && <Link href="/practice" className="btn-primary">Тренироваться</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Добавить вопрос</h2>
          <QuestionForm action={createQuestion} submitLabel="Добавить" />
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Загрузить списком</h2>
          <ImportForm />
        </section>
      </div>

      <ul className="mt-8 space-y-3">
        {questions.length === 0 && (
          <li className="card text-center text-slate-500">Пока нет вопросов. Добавьте первый или загрузите список.</li>
        )}
        {questions.map((q) => {
          const last = q.attempts[0]?.score;
          return (
            <li key={q.id} className="card">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  {q.topic && <span className="mb-1 inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{q.topic}</span>}
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
    </div>
  );
}
