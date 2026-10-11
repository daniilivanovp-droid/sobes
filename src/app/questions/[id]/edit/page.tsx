import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateQuestion } from "@/lib/actions";
import QuestionForm from "@/components/QuestionForm";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const question = await db.question.findFirst({ where: { id, userId: user.id } });
  if (!question) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/questions" className="text-sm text-slate-500 hover:underline">← Мои вопросы</Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Изменить вопрос</h1>
      <div className="card">
        <QuestionForm action={updateQuestion.bind(null, question.id)} initial={question} submitLabel="Сохранить" />
      </div>
    </div>
  );
}
