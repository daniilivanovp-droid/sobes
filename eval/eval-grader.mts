// Measures how close the grader's scores are to hand-labelled ones.
// Usage: npm run eval:grader   (backend is picked from .env the same way as in the app: GRADER, OLLAMA_MODEL, ANTHROPIC_API_KEY)
import { readFileSync, writeFileSync } from "node:fs";
import { gradeAnswer, graderBackend } from "../src/lib/grader.ts";

type Case = { kind: string; expected: number; text: string };
type Q = { id: string; question: string; reference: string; answers: Case[] };

const data = JSON.parse(readFileSync(new URL("./grader-cases.json", import.meta.url), "utf8")) as { questions: Q[] };
const backend = graderBackend();
const label = backend === "ollama" ? `ollama:${process.env.OLLAMA_MODEL || "qwen3:8b"}` : backend === "claude" ? `claude:${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"}` : "heuristic";
console.log(`Грейдер: ${label}\n`);

const rows: { q: string; kind: string; expected: number; got: number | null; ms: number; error?: string }[] = [];
for (const q of data.questions) {
  for (const a of q.answers) {
    const t = Date.now();
    try {
      const g = await gradeAnswer({ question: q.question, reference: q.reference, answer: a.text });
      rows.push({ q: q.id, kind: a.kind, expected: a.expected, got: g.score, ms: Date.now() - t });
    } catch (e) {
      rows.push({ q: q.id, kind: a.kind, expected: a.expected, got: null, ms: Date.now() - t, error: String(e) });
    }
    const r = rows[rows.length - 1];
    console.log(`${q.id.padEnd(16)} ${r.kind.padEnd(10)} ожидалось ${String(r.expected).padStart(2)}  получено ${r.got === null ? "ошибка" : String(r.got).padStart(2)}  ${(r.ms / 1000).toFixed(1)}с${r.error ? "  " + r.error : ""}`);
  }
}

const ok = rows.filter((r) => r.got !== null) as (typeof rows[number] & { got: number })[];
const mae = ok.reduce((s, r) => s + Math.abs(r.got - r.expected), 0) / (ok.length || 1);
const within2 = ok.filter((r) => Math.abs(r.got - r.expected) <= 2).length;
const falsePass = ok.filter((r) => (r.kind === "wrong" || r.kind === "empty") && r.got >= 5);
const order = ["full", "partial", "wrong", "empty"];
let ordered = 0;
for (const q of data.questions) {
  const s = order.map((k) => ok.find((r) => r.q === q.id && r.kind === k)?.got);
  if (s.every((x) => x !== undefined) && s.every((x, i) => i === 0 || (s[i - 1] as number) >= (x as number))) ordered++;
}
const byKind = Object.fromEntries(
  ["full", "paraphrase", "partial", "wrong", "empty"].map((k) => {
    const xs = ok.filter((r) => r.kind === k).map((r) => r.got);
    return [k, xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null];
  }),
);
const summary = {
  grader: label,
  cases: rows.length,
  errors: rows.length - ok.length,
  meanAbsError: +mae.toFixed(2),
  within2: `${within2}/${ok.length}`,
  wrongAnswersPassed: `${falsePass.length}/${rows.filter((r) => r.kind === "wrong" || r.kind === "empty").length}`,
  questionsRankedCorrectly: `${ordered}/${data.questions.length}`,
  avgScoreByKind: byKind,
  avgSeconds: +(rows.reduce((s, r) => s + r.ms, 0) / rows.length / 1000).toFixed(1),
};
console.log("\n" + JSON.stringify(summary, null, 2));
writeFileSync(new URL(`./results-${label.replace(/[:/]/g, "_")}.json`, import.meta.url), JSON.stringify({ summary, rows }, null, 2));
