import Anthropic from "@anthropic-ai/sdk";

export type Backend = "claude" | "ollama" | "heuristic";

const ollamaUrl = () => process.env.OLLAMA_URL || "http://localhost:11434";
export const ollamaModel = () => process.env.OLLAMA_MODEL || "qwen3:8b";
export const claudeModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

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

// GRADER selects the AI backend: "claude", "ollama" or "heuristic".
// Without it: Claude if ANTHROPIC_API_KEY is set, else a running Ollama with the model pulled, else no AI.
export async function aiBackend(): Promise<Backend> {
  const explicit = process.env.GRADER?.trim().toLowerCase();
  if (explicit === "claude" || explicit === "ollama" || explicit === "heuristic") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return (await ollamaAvailable()) ? "ollama" : "heuristic";
}

export function backendLabel(backend: Backend) {
  return backend === "claude" ? `claude:${claudeModel()}` : backend === "ollama" ? `ollama:${ollamaModel()}` : "heuristic";
}

// One request that must return JSON matching `schema`.
export async function chatJson<T>(backend: "claude" | "ollama", system: string, user: string, schema: object): Promise<T> {
  return backend === "ollama" ? chatOllama<T>(system, user, schema) : chatClaude<T>(system, user, schema);
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
