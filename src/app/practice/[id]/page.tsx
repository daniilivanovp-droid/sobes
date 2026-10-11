import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { scoreColor } from "@/lib/format";
import AnswerBox from "@/components/AnswerBox";
import { aiBackend } from "@/lib/llm";
import { nextQuestion } from "@/lib/actions";

export default async function PracticeQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const question = await db.question.findFirst({
    where: { id, userId: user.id },
    include: { attempts: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!question) notFound();
  const aiEnabled = (await aiBackend()) !== "heuristic";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/questions" className="text-sm text-slate-500 hover:underline">← Мои вопросы</Link>
        <form action={nextQuestion.bind(null, question.id)}>
          <button className="text-sm text-indigo-600 hover:underline">Пропустить →</button>
        </form>
      </div>

      <div className="card mt-4">
        {question.topic && <span className="mb-2 inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{question.topic}</span>}
        <h1 className="text-xl font-semibold">{question.text}</h1>
      </div>

      <AnswerBox questionId={question.id} reference={question.referenceAnswer} aiEnabled={aiEnabled} />

      {question.attempts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Предыдущие попытки</h2>
          <ul className="mt-3 space-y-2">
            {question.attempts.map((a) => (
              <li key={a.id} className="card flex gap-3 py-3 text-sm">
                <span className={`h-fit rounded px-2 py-1 font-semibold ${scoreColor(a.score)}`}>{a.score}/10</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">
                    {a.createdAt.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })} · {a.inputMode === "voice" ? "голосом" : "текстом"} · {a.verdict}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-700">{a.answer}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
