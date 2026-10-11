"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { scoreColor } from "@/lib/format";

type Result = {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  missing: string[];
  mistakes: string[];
  followUp: string;
  grader: "llm" | "heuristic";
  reference: string;
};

// Minimal typings for the Web Speech API (not in lib.dom for all browsers).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = { questionId: string; reference: string; aiEnabled: boolean };

export default function AnswerBox({ questionId, reference, aiEnabled }: Props) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [showReference, setShowReference] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setVoiceSupported(!!getRecognitionCtor());
    return () => recRef.current?.stop();
  }, []);

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setAnswer((prev) => (prev ? prev.trimEnd() + " " : "") + finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Нет доступа к микрофону. Разрешите его в настройках браузера.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Ошибка распознавания речи: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    setError("");
    setUsedVoice(true);
    setListening(true);
    rec.start();
  }

  async function submit() {
    recRef.current?.stop();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer, inputMode: usedVoice ? "voice" : "text" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка оценки");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оценки");
    } finally {
      setLoading(false);
    }
  }

  function revealReference() {
    recRef.current?.stop();
    setShowReference(true);
  }

  function retry() {
    setResult(null);
    setShowReference(false);
    setAnswer("");
    setUsedVoice(false);
  }

  if (result) {
    return (
      <div className="mt-6 space-y-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-2xl font-bold ${scoreColor(result.score)}`}>{result.score}/10</span>
            <span className="text-lg font-medium">{result.verdict}</span>
            {result.grader === "heuristic" && <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">без ИИ</span>}
          </div>
          <p className="mt-4 text-slate-700">{result.summary}</p>
          <FeedbackList title="Что хорошо" items={result.strengths} tone="text-green-700" />
          <FeedbackList title="Чего не хватило" items={result.missing} tone="text-amber-700" />
          <FeedbackList title="Ошибки и неточности" items={result.mistakes} tone="text-red-700" />
          {result.followUp && (
            <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm">
              <span className="font-medium text-indigo-800">Интервьюер уточнил бы: </span>
              {result.followUp}
            </div>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-500">Ваш ответ и эталон</summary>
            <p className="mt-2 font-medium">Ваш ответ</p>
            <p className="whitespace-pre-wrap text-slate-700">{answer}</p>
            <p className="mt-3 font-medium">Эталон</p>
            <p className="whitespace-pre-wrap text-slate-700">{result.reference}</p>
          </details>
        </div>
        <div className="flex gap-3">
          <Link href={`/practice?after=${questionId}`} className="btn-primary">Следующий вопрос</Link>
          <button onClick={retry} className="btn-secondary">Ответить ещё раз</button>
        </div>
      </div>
    );
  }

  if (showReference) {
    return (
      <div className="mt-6 space-y-4">
        <div className="card">
          {answer.trim() && (
            <>
              <p className="text-sm font-medium text-slate-500">Ваш ответ</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{answer}</p>
              <hr className="my-4 border-slate-200" />
            </>
          )}
          <p className="text-sm font-medium text-slate-500">Эталонный ответ</p>
          <p className="mt-1 whitespace-pre-wrap">{reference}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {answer.trim() && (
            <button onClick={submit} disabled={loading} className="btn-primary">
              {loading ? "Проверяю…" : aiEnabled ? "Проверить ИИ" : "Проверить (без ИИ)"}
            </button>
          )}
          <Link href={`/practice?after=${questionId}`} className={answer.trim() ? "btn-secondary" : "btn-primary"}>Следующий вопрос</Link>
          <button onClick={retry} className="btn-secondary">Ответить ещё раз</button>
        </div>
        {loading && aiEnabled && <p className="text-sm text-slate-500">ИИ проверяет ответ, обычно это занимает до 30 секунд.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <textarea
        value={listening && interim ? `${answer} ${interim}`.trim() : answer}
        onChange={(e) => setAnswer(e.target.value)}
        readOnly={listening}
        rows={8}
        placeholder={voiceSupported ? "Напечатайте ответ или нажмите «Ответить голосом»" : "Напечатайте ответ"}
        className="input text-base"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={loading || listening || !answer.trim()} className="btn-primary">
          {loading ? "Проверяю…" : aiEnabled ? "Проверить ИИ" : "Проверить (без ИИ)"}
        </button>
        <button onClick={revealReference} disabled={loading} className="btn-secondary">
          Показать эталон
        </button>
        {voiceSupported ? (
          <button onClick={toggleVoice} disabled={loading} className={listening ? "btn-secondary border-red-300 text-red-600" : "btn-secondary"}>
            {listening ? "■ Остановить запись" : "🎤 Ответить голосом"}
          </button>
        ) : (
          <span className="text-sm text-slate-500">Голосовой ввод не поддерживается в этом браузере (работает в Chrome, Edge, Safari).</span>
        )}
        {listening && <span className="animate-pulse text-sm text-red-600">Идёт запись…</span>}
      </div>
      {loading && aiEnabled && <p className="mt-3 text-sm text-slate-500">ИИ проверяет ответ, обычно это занимает до 30 секунд.</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
