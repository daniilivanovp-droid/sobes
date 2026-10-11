"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./db";
import { requireUser } from "./auth";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "./session";
import { parseQuestionBlocks } from "./parse";
import { getPracticeSections, markPracticed, pickNextQuestion, setPracticeSections } from "./practice";

export type FormState = { error?: string; message?: string };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен быть не короче 6 символов"),
});

async function startSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
}

function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/questions";
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = String(form.get("name") ?? "").trim() || null;

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Пользователь с таким email уже зарегистрирован" };

  const user = await db.user.create({
    data: { email: parsed.data.email, name, passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  await startSession(user.id);
  redirect("/questions");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Неверный email или пароль" };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Неверный email или пароль" };
  }
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/");
}

const questionSchema = z.object({
  topic: z.string().trim().max(100),
  text: z.string().trim().min(3, "Введите вопрос"),
  referenceAnswer: z.string().trim().min(3, "Введите эталонный ответ"),
});

export async function createQuestion(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = questionSchema.safeParse({
    topic: form.get("topic") ?? "",
    text: form.get("text"),
    referenceAnswer: form.get("referenceAnswer"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.question.create({
    data: { ...parsed.data, topic: parsed.data.topic || null, userId: user.id },
  });
  revalidatePath("/questions");
  return { message: "Вопрос добавлен" };
}

export async function importQuestions(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const topic = String(form.get("topic") ?? "").trim() || null;
  const items = parseQuestionBlocks(String(form.get("bulk") ?? ""));
  if (!items.length) return { error: "Не нашёл ни одного вопроса. Проверьте формат." };
  await db.question.createMany({
    data: items.map((q) => ({ ...q, topic, userId: user.id })),
  });
  revalidatePath("/questions");
  return { message: `Загружено вопросов: ${items.length}` };
}

export async function updateQuestion(id: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = questionSchema.safeParse({
    topic: form.get("topic") ?? "",
    text: form.get("text"),
    referenceAnswer: form.get("referenceAnswer"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { count } = await db.question.updateMany({
    where: { id, userId: user.id },
    data: { ...parsed.data, topic: parsed.data.topic || null },
  });
  if (!count) return { error: "Вопрос не найден" };
  revalidatePath("/questions");
  redirect("/questions");
}

export async function deleteQuestion(form: FormData) {
  const user = await requireUser();
  await db.question.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  revalidatePath("/questions");
}

// Showing the reference counts as practice, so the question moves to the back of the queue.
export async function markReferenceShown(questionId: string) {
  const user = await requireUser();
  await markPracticed(user.id, questionId);
}

// Leaving a question (next or skip) moves it to the back of the queue, so the deck rotates fully.
export async function nextQuestion(currentId: string) {
  const user = await requireUser();
  await markPracticed(user.id, currentId);
  const sections = await getPracticeSections();
  const next = await pickNextQuestion(user.id, currentId, sections);
  if (next) redirect(`/practice/${next}`);
  // Nothing else in the chosen sections: stay on this question if it belongs to them, else pick sections again.
  const stillThere = await pickNextQuestion(user.id, undefined, sections);
  redirect(stillThere ? `/practice/${stillThere}` : "/practice");
}

// Starts practice over the sections ticked on /practice. Ticking all of them means "all questions",
// so sections added later are included too.
export async function startPractice(form: FormData) {
  const user = await requireUser();
  const chosen = form.getAll("section").map(String);
  if (!chosen.length) redirect("/practice");
  const total = Number(form.get("total") ?? 0);
  const sections = chosen.length === total ? [] : chosen;
  await setPracticeSections(sections);
  const next = await pickNextQuestion(user.id, undefined, sections);
  redirect(next ? `/practice/${next}` : "/practice");
}
