import { db } from "./db";

// Next question to practice: round-robin over the whole deck, so every question comes up once per pass.
// Never practiced first, then the one practiced longest ago.
export async function pickNextQuestion(userId: string, excludeId?: string) {
  const questions = await db.question.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, lastPracticedAt: true },
  });
  if (!questions.length) return null;

  const fresh = questions.filter((q) => !q.lastPracticedAt);
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)].id;

  return questions.sort((a, b) => a.lastPracticedAt!.getTime() - b.lastPracticedAt!.getTime())[0].id;
}

export async function markPracticed(userId: string, questionId: string) {
  await db.question.updateMany({ where: { id: questionId, userId }, data: { lastPracticedAt: new Date() } });
}
