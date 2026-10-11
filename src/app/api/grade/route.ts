import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { gradeAnswer } from "@/lib/grader";
import { markPracticed } from "@/lib/practice";

const body = z.object({
  questionId: z.string(),
  answer: z.string().trim().min(1).max(20000),
  inputMode: z.enum(["text", "voice"]),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Введите ответ" }, { status: 400 });

  const question = await db.question.findFirst({
    where: { id: parsed.data.questionId, userId: user.id },
  });
  if (!question) return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });

  try {
    const grade = await gradeAnswer({
      question: question.text,
      reference: question.referenceAnswer,
      answer: parsed.data.answer,
    });
    const { score, verdict, grader, ...feedback } = grade;
    const attempt = await db.attempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        answer: parsed.data.answer,
        inputMode: parsed.data.inputMode,
        score,
        verdict,
        grader,
        feedback: JSON.stringify(feedback),
      },
    });
    await markPracticed(user.id, question.id);
    return NextResponse.json({ attemptId: attempt.id, ...grade, reference: question.referenceAnswer });
  } catch (err) {
    console.error("grading failed", err);
    const message = err instanceof Error && /^(Ollama|Groq|LLM API)/.test(err.message) ? err.message : "Не удалось оценить ответ, попробуйте ещё раз";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
