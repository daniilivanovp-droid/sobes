import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { pickNextQuestion } from "@/lib/practice";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const user = await requireUser();
  const { after } = await searchParams;
  const id = (await pickNextQuestion(user.id, after)) ?? (after ? after : null);
  if (id) redirect(`/practice/${id}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Нет вопросов для тренировки</h1>
      <p className="mt-3 text-slate-600">Сначала добавьте вопросы с эталонными ответами.</p>
      <Link href="/questions" className="btn-primary mt-6 inline-block">Добавить вопросы</Link>
    </div>
  );
}
