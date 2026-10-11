import Anthropic from "@anthropic-ai/sdk";

export type Grade = {
  score: number; // 0..10
  verdict: string;
  summary: string;
  strengths: string[];
  missing: string[];
  mistakes: string[];
  followUp: string;
  grader: "llm" | "heuristic";
};

const VERDICTS = ["Отлично", "Хорошо", "Удовлетворительно", "Слабо", "Не засчитано"] as const;

const GRADE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Оценка от 0 до 10" },
    verdict: { type: "string", enum: [...VERDICTS] },
    summary: { type: "string", description: "2-3 предложения: общее впечатление интервьюера" },
    strengths: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" }, description: "Что из эталона не прозвучало" },
    mistakes: { type: "array", items: { type: "string" }, description: "Фактические ошибки и неточности" },
    followUp: { type: "string", description: "Уточняющий вопрос, который задал бы интервьюер" },
  },
  required: ["score", "verdict", "summary", "strengths", "missing", "mistakes", "followUp"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Ты опытный технический интервьюер на реальном собеседовании. Кандидат отвечает на вопрос устно или письменно, у тебя есть эталонный ответ.

Оцени ответ кандидата так, как оценил бы его на собеседовании:
- Сравнивай по смыслу, а не по формулировкам. Другие слова или порядок изложения не снижают оценку.
- Главное: покрыты ли ключевые идеи эталона и нет ли фактических ошибок. Верные дополнения сверх эталона засчитываются в плюс.
- Ответ, распознанный из речи, может содержать опечатки и ошибки распознавания; не штрафуй за них.
- Шкала: 9-10 отлично, 7-8 хорошо, 5-6 удовлетворительно, 3-4 слабо, 0-2 не засчитано.
- Пиши по-русски, коротко и по делу, обращаясь к кандидату на «вы». Пункты в списках короткие. Если пунктов нет, оставь список пустым.`;

export async function gradeAnswer(input: {
  question: string;
  reference: string;
  answer: string;
}): Promise<Grade> {
  if (!process.env.ANTHROPIC_API_KEY) return heuristicGrade(input);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: GRADE_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `<question>\n${input.question}\n</question>\n\n<reference_answer>\n${input.reference}\n</reference_answer>\n\n<candidate_answer>\n${input.answer}\n</candidate_answer>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Модель отказалась оценивать этот ответ");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Пустой ответ модели");
  const parsed = JSON.parse(text.text) as Omit<Grade, "grader">;
  return { ...parsed, score: clamp(parsed.score), grader: "llm" };
}

function clamp(n: number) {
  return Math.max(0, Math.min(10, Math.round(n)));
}

// Fallback without an API key: compares key terms of the reference with the answer.
const STOP_WORDS = new Set(
  "это этот эта эти который которая которые также чтобы когда если потому может можно нужно очень более менее тоже только через после перед между будет были было есть быть просто такой такие такая всего всех всегда where which that this with from have will when there their about would could should into than then them they what".split(" "),
);

function stems(text: string) {
  return (text.toLowerCase().match(/[a-zа-яё0-9]+/g) ?? [])
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .map((w) => w.slice(0, 6));
}

export function heuristicGrade(input: { reference: string; answer: string }): Grade {
  const answerStems = new Set(stems(input.answer));
  const refStems = [...new Set(stems(input.reference))];
  const covered = refStems.filter((s) => answerStems.has(s));
  const recall = refStems.length ? covered.length / refStems.length : 0;
  const score = clamp(recall * 12); // full coverage is rarely verbatim, so allow some slack

  const sentences = input.reference
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const missing: string[] = [];
  const strengths: string[] = [];
  for (const s of sentences) {
    const st = [...new Set(stems(s))];
    if (!st.length) continue;
    const hit = st.filter((x) => answerStems.has(x)).length / st.length;
    (hit >= 0.5 ? strengths : missing).push(s);
  }

  return {
    score,
    verdict: score >= 9 ? VERDICTS[0] : score >= 7 ? VERDICTS[1] : score >= 5 ? VERDICTS[2] : score >= 3 ? VERDICTS[3] : VERDICTS[4],
    summary: `Упрощённая оценка без ИИ: в ответе прозвучало ${covered.length} из ${refStems.length} ключевых понятий эталона. Подключите ключ Claude API, чтобы получить разбор как от интервьюера.`,
    strengths: strengths.slice(0, 5),
    missing: missing.slice(0, 5),
    mistakes: [],
    followUp: "",
    grader: "heuristic",
  };
}
