import { aiBackend, chatJson } from "./llm";

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

// Lists come before the score so that smaller models reason about coverage first, then score.
const GRADE_SCHEMA = {
  type: "object",
  properties: {
    strengths: { type: "array", items: { type: "string" }, description: "Что в ответе верно" },
    missing: { type: "array", items: { type: "string" }, description: "Что из эталона не прозвучало" },
    mistakes: { type: "array", items: { type: "string" }, description: "Фактические ошибки и неточности" },
    summary: { type: "string", description: "2-3 предложения: общее впечатление интервьюера" },
    score: { type: "integer", description: "Оценка от 0 до 10" },
    followUp: { type: "string", description: "Уточняющий вопрос, который задал бы интервьюер" },
  },
  required: ["strengths", "missing", "mistakes", "summary", "score", "followUp"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Ты опытный технический интервьюер на реальном собеседовании. Кандидат отвечает на вопрос устно или письменно, у тебя есть эталонный ответ.

Оцени ответ кандидата так, как оценил бы его на собеседовании:
- Сравнивай по смыслу, а не по формулировкам. Другие слова или порядок изложения не снижают оценку.
- Главное: покрыты ли ключевые идеи эталона и нет ли фактических ошибок. Верные дополнения сверх эталона засчитываются в плюс.
- Фактическая ошибка в ключевом утверждении снижает оценку сильнее, чем упущенная деталь. Ответ не по теме или «не знаю» получает 0-1.
- Ответ, распознанный из речи, может содержать опечатки и ошибки распознавания; не штрафуй за них.
- Шкала: 9-10 отлично (все ключевые идеи, без ошибок), 7-8 хорошо (суть верна, упущены детали), 5-6 удовлетворительно (половина ключевых идей), 3-4 слабо (отдельные верные мысли), 0-2 не засчитано.
- Пиши по-русски, коротко и по делу, обращаясь к кандидату на «вы». Пункты в списках короткие. Если пунктов нет, оставь список пустым.
- Верни только JSON по заданной схеме.`;

type GradeInput = { question: string; reference: string; answer: string };
type LlmGrade = Omit<Grade, "grader" | "verdict">;

function userPrompt(input: GradeInput) {
  return `<question>\n${input.question}\n</question>\n\n<reference_answer>\n${input.reference}\n</reference_answer>\n\n<candidate_answer>\n${input.answer}\n</candidate_answer>`;
}

export async function gradeAnswer(input: GradeInput): Promise<Grade> {
  const backend = await aiBackend();
  if (backend === "heuristic") return heuristicGrade(input);
  const parsed = await chatJson<Partial<LlmGrade>>(backend, SYSTEM_PROMPT, userPrompt(input), GRADE_SCHEMA);
  const score = clamp(Number(parsed.score ?? 0));
  return {
    strengths: parsed.strengths ?? [],
    missing: parsed.missing ?? [],
    mistakes: parsed.mistakes ?? [],
    summary: parsed.summary ?? "",
    followUp: parsed.followUp ?? "",
    score,
    verdict: verdictFor(score),
    grader: "llm",
  };
}

export function verdictFor(score: number) {
  return score >= 9 ? VERDICTS[0] : score >= 7 ? VERDICTS[1] : score >= 5 ? VERDICTS[2] : score >= 3 ? VERDICTS[3] : VERDICTS[4];
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
    verdict: verdictFor(score),
    summary: `Упрощённая оценка без ИИ: в ответе прозвучало ${covered.length} из ${refStems.length} ключевых понятий эталона. Подключите Claude или локальную модель через Ollama, чтобы получить разбор как от интервьюера.`,
    strengths: strengths.slice(0, 5),
    missing: missing.slice(0, 5),
    mistakes: [],
    followUp: "",
    grader: "heuristic",
  };
}
