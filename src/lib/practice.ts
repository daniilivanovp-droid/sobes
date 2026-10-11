import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

// Sections are the questions' `topic` values; "" stands for questions without a section.
export const NO_SECTION = "";
const TOPICS_COOKIE = "practice_sections";

export function sectionFilter(sections: string[]): Prisma.QuestionWhereInput {
  if (!sections.length) return {};
  const named = sections.filter((s) => s !== NO_SECTION);
  const or: Prisma.QuestionWhereInput[] = [];
  if (named.length) or.push({ topic: { in: named } });
  if (sections.includes(NO_SECTION)) or.push({ topic: null });
  return { OR: or };
}

export async function listSections(userId: string) {
  const groups = await db.question.groupBy({ by: ["topic"], where: { userId }, _count: { _all: true } });
  return groups
    .map((g) => ({ name: g.topic ?? NO_SECTION, count: g._count._all }))
    .sort((a, b) => (a.name === NO_SECTION ? 1 : b.name === NO_SECTION ? -1 : a.name.localeCompare(b.name, "ru")));
}

// Sections chosen for practice; an empty list means all questions.
export async function getPracticeSections(): Promise<string[]> {
  const raw = (await cookies()).get(TOPICS_COOKIE)?.value;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function setPracticeSections(sections: string[]) {
  (await cookies()).set(TOPICS_COOKIE, JSON.stringify(sections), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// Next question to practice: round-robin over the chosen sections, so every question comes up once per pass.
// Never practiced first, then the one practiced longest ago.
export async function pickNextQuestion(userId: string, excludeId?: string, sections: string[] = []) {
  const questions = await db.question.findMany({
    where: { userId, ...sectionFilter(sections), ...(excludeId ? { id: { not: excludeId } } : {}) },
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
