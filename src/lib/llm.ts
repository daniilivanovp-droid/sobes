import Anthropic from "@anthropic-ai/sdk";

export type Backend = "claude" | "groq" | "openai" | "ollama" | "heuristic";
type AiBackend = Exclude<Backend, "heuristic">;

const ollamaUrl = () => process.env.OLLAMA_URL || "http://localhost:11434";
export const ollamaModel = () => process.env.OLLAMA_MODEL || "qwen3:8b";
export const claudeModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// OpenAI-compatible chat APIs: Groq preset, or any other provider via LLM_BASE_URL/LLM_API_KEY/LLM_MODEL.
function openAiCompatible(backend: "groq" | "openai") {
  return backend === "groq"
    ? {
        name: "Groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      }
    : {
        name: "LLM API",
        baseUrl: (process.env.LLM_BASE_URL || "").replace(/\/$/, ""),
        apiKey: process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL || "",
      };
}

let ollamaProbe: { at: number; ok: boolean } | null = null;

async function ollamaAvailable() {
  if (ollamaProbe && Date.now() - ollamaProbe.at < 30_000) return ollamaProbe.ok;
  let ok = false;
  try {
    const res = await fetch(`${ollamaUrl()}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const data = (await res.json()) as { models?: { name: string }[] };
    const wanted = ollamaModel();
    ok = !!data.models?.some((m) => m.name === wanted || m.name === `${wanted}:latest`);
  } catch {
    ok = false;
  }
  ollamaProbe = { at: Date.now(), ok };
  return ok;
}

const BACKENDS: Backend[] = ["claude", "groq", "openai", "ollama", "heuristic"];

// GRADER selects the AI backend: claude, groq, openai, ollama or heuristic.
// Without it: Claude or Groq if their key is set, else a running Ollama with the model pulled, else no AI.
export async function aiBackend(): Promise<Backend> {
  const explicit = process.env.GRADER?.trim().toLowerCase() as Backend | undefined;
  if (explicit && BACKENDS.includes(explicit)) return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GROQ_API_KEY) return "groq";
  return (await ollamaAvailable()) ? "ollama" : "heuristic";
}

export function backendLabel(backend: Backend) {
  if (backend === "claude") return `claude:${claudeModel()}`;
  if (backend === "ollama") return `ollama:${ollamaModel()}`;
  if (backend === "groq" || backend === "openai") return `${backend}:${openAiCompatible(backend).model}`;
  return "heuristic";
}

// One request that must return JSON matching `schema`.
export async function chatJson<T>(backend: AiBackend, system: string, user: string, schema: object): Promise<T> {
  if (backend === "ollama") return chatOllama<T>(system, user, schema);
  if (backend === "claude") return chatClaude<T>(system, user, schema);
  return chatOpenAiCompatible<T>(backend, system, user, schema);
}

async function chatOpenAiCompatible<T>(backend: "groq" | "openai", system: string, user: string, schema: object): Promise<T> {
  const cfg = openAiCompatible(backend);
  if (!cfg.apiKey) throw new Error(`${cfg.name}: не задан ключ API в .env`);
  if (!cfg.baseUrl || !cfg.model) throw new Error(`${cfg.name}: не задан адрес или модель в .env`);

  // Structured output can occasionally fail validation on the provider side; one retry covers that.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new Error(`${cfg.name} недоступен. Проверьте интернет-соединение.`);
    }
    if (res.status === 401 || res.status === 403) throw new Error(`${cfg.name}: ключ API не подошёл (ошибка ${res.status})`);
    if (res.status === 429) throw new Error(`${cfg.name}: превышен лимит бесплатных запросов, попробуйте через минуту`);
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)) as T;
    }
    lastError = `${cfg.name} вернул ошибку ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
  }
  throw new Error(lastError);
}

async function chatClaude<T>(system: string, user: string, schema: object): Promise<T> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: claudeModel(),
    max_tokens: 4000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Модель отказалась отвечать на этот запрос");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Пустой ответ модели");
  return JSON.parse(text.text) as T;
}

// Local open-source model served by Ollama (https://ollama.com), e.g. qwen3:8b.
async function chatOllama<T>(system: string, user: string, schema: object): Promise<T> {
  const baseUrl = ollamaUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel(),
        stream: false,
        think: false,
        format: schema,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new Error(`Ollama недоступна по адресу ${baseUrl}. Запустите приложение Ollama.`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ollama вернула ошибку ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  // Some models still wrap JSON in text; take the outermost object.
  return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)) as T;
}
