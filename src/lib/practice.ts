import { db } from "./db";

// Next question to practice: unanswered ones first, then the one with the weakest/oldest last attempt.
export async function pickNextQuestion(userId: string, excludeId?: string) {
  const questions = await db.question.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { score: true, createdAt: true } } },
  });
  if (!questions.length) return null;

  const unanswered = questions.filter((q) => !q.attempts.length);
  if (unanswered.length) return unanswered[Math.floor(Math.random() * unanswered.length)].id;

  // Lower score and older attempt -> higher priority; a little randomness to avoid loops.
  const ranked = questions
    .map((q) => {
      const a = q.attempts[0];
      const days = (Date.now() - a.createdAt.getTime()) / 86_400_000;
      return { id: q.id, priority: (10 - a.score) + Math.min(days, 7) + Math.random() * 2 };
    })
    .sort((x, y) => y.priority - x.priority);
  return ranked[0].id;
}
