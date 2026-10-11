// Reads a Notion page with a question bank and turns it into questions grouped by section.
// Expected page layout (what a typical bank looks like):
//   Heading or short standalone line  -> section ("Python", "Базовые:")
//   Numbered/bulleted item or toggle  -> question; its nested blocks (and plain blocks right after it) -> reference answer
//   "Эталонный ответ:" labels are dropped; an answer written on the question's own line after "?" is split off.

const API = process.env.NOTION_API_URL || "https://api.notion.com/v1";
const VERSION = "2022-06-28";

type RichText = { plain_text: string };
export type Block = {
  id: string;
  type: string;
  has_children: boolean;
  children?: Block[];
  [key: string]: unknown;
};

export type NotionQuestion = { notionId: string; section: string | null; text: string; referenceAnswer: string };
export type NotionBank = { questions: NotionQuestion[]; skipped: string[] };

export const notionConfigured = () => !!process.env.NOTION_TOKEN;

async function notion<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Notion: ключ NOTION_TOKEN не подошёл. Проверьте его в .env.");
  if (res.status === 404) throw new Error("Notion: страница не найдена. Откройте её в Notion → «…» → Connections и добавьте свою интеграцию.");
  if (!res.ok) throw new Error(`Notion: ошибка ${res.status}`);
  return res.json() as Promise<T>;
}

// NOTION_PAGE can be a page link or id; without it the page is found by title.
async function findPageId(): Promise<string> {
  const configured = process.env.NOTION_PAGE?.trim();
  if (configured) {
    const hex = configured.replace(/-/g, "").match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i);
    if (!hex) throw new Error("Notion: в NOTION_PAGE не нашёл id страницы. Вставьте ссылку на страницу целиком.");
    return hex[0];
  }
  const title = process.env.NOTION_PAGE_TITLE || "Банк вопросов";
  const found = await notion<{ results: { id: string; properties?: Record<string, { type: string; title?: RichText[] }> }[] }>("/search", {
    method: "POST",
    body: JSON.stringify({ query: title, filter: { property: "object", value: "page" } }),
  });
  const page = found.results.find((p) =>
    Object.values(p.properties ?? {}).some((prop) => prop.type === "title" && prop.title?.map((t) => t.plain_text).join("").trim() === title),
  ) ?? found.results[0];
  if (!page) throw new Error(`Notion: не нашёл страницу «${title}». Откройте её в Notion → «…» → Connections и добавьте свою интеграцию.`);
  return page.id;
}

async function children(id: string): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  do {
    const page = await notion<{ results: Block[]; has_more: boolean; next_cursor: string | null }>(
      `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
    );
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  // Synced blocks and columns just wrap content; nested blocks are needed for answers.
  await Promise.all(out.filter((b) => b.has_children && b.type !== "child_page" && b.type !== "child_database").map(async (b) => {
    b.children = await children(b.id);
  }));
  return out;
}

export async function fetchNotionBank(): Promise<NotionBank> {
  return parseBlocks(await children(await findPageId()));
}

// ---- parsing (pure, unit-testable) ----

const HEADINGS = ["heading_1", "heading_2", "heading_3"];
const ITEMS = ["numbered_list_item", "bulleted_list_item", "toggle"];
const WRAPPERS = ["column_list", "column", "synced_block"];

function textOf(b: Block): string {
  const body = b[b.type] as { rich_text?: RichText[] } | undefined;
  return (body?.rich_text ?? []).map((t) => t.plain_text).join("");
}

function render(blocks: Block[], depth = 0): string[] {
  const lines: string[] = [];
  let n = 0;
  for (const b of blocks) {
    const pad = "  ".repeat(depth);
    const text = textOf(b);
    n = b.type === "numbered_list_item" ? n + 1 : 0;
    if (b.type === "code") lines.push(text);
    else if (b.type === "numbered_list_item") lines.push(`${pad}${n}. ${text}`);
    else if (b.type === "bulleted_list_item" || b.type === "to_do") lines.push(`${pad}- ${text}`);
    else if (b.type === "divider") continue;
    else if (text || b.type === "paragraph") lines.push(pad + text);
    if (b.children?.length) lines.push(...render(b.children, WRAPPERS.includes(b.type) ? depth : depth + 1));
  }
  return lines;
}

const LABEL = /^\s*(эталонный\s+)?ответ\s*\**\s*:\s*\**\s*/i;
const cleanAnswer = (lines: string[]) =>
  lines.join("\n").replace(LABEL, "").replace(/\n{3,}/g, "\n\n").trim();
const cleanQuestion = (s: string) => s.replace(/^\s*вопрос\s*:\s*/i, "").trim();

// "Вопрос? Ответ" or "Вопрос? (Ответ.)" on one line -> split; otherwise no answer.
function splitInline(text: string): [string, string] {
  const paren = text.match(/^([\s\S]*?)\s*\(([^()]+)\)\s*$/);
  if (paren && paren[1].trim().endsWith("?")) return [paren[1].trim(), paren[2].trim()];
  const q = text.indexOf("? ");
  if (q > 0) return [text.slice(0, q + 1), text.slice(q + 2).replace(/^\s*честный ответ\s*:\s*/i, "")];
  const dot = text.indexOf(". ");
  if (dot > 0 && /^(расскажи|опиши|объясни)/i.test(text)) return [text.slice(0, dot + 1), text.slice(dot + 2)];
  return [text, ""];
}

function isSectionLine(b: Block): boolean {
  if (b.type !== "paragraph" || b.has_children) return false;
  const t = textOf(b).trim();
  return !!t && t.length <= 60 && !/[?.!]$/.test(t) && !t.includes("\n");
}

export function parseBlocks(blocks: Block[]): NotionBank {
  const questions: NotionQuestion[] = [];
  const skipped: string[] = [];
  let section: string | null = null;
  let current: { block: Block; extra: Block[] } | null = null;

  const flush = () => {
    if (!current) return;
    const { block, extra } = current;
    current = null;
    let [text, inline] = splitInline(cleanQuestion(textOf(block)));
    const nested = cleanAnswer([...render(block.children ?? []), ...render(extra)]);
    // "Эталонный ответ:" sometimes sits on its own line, then the answer is plain blocks after the item.
    const answer = [inline, nested].filter(Boolean).join("\n");
    text = text.trim();
    if (!text) return;
    if (!answer) skipped.push(text);
    else questions.push({ notionId: block.id, section, text, referenceAnswer: answer });
  };

  const walk = (list: Block[]) => {
    for (const b of list) {
      if (WRAPPERS.includes(b.type)) {
        walk(b.children ?? []);
      } else if (HEADINGS.includes(b.type) || (!current && isSectionLine(b)) || (current && hasAnswer(current) && isSectionLine(b) && !/:\s*$/.test(textOf(b)) && nextIsItem(list, b))) {
        flush();
        section = textOf(b).trim().replace(/[:：]\s*$/, "") || null;
        if (b.children?.length) walk(b.children); // toggleable heading
      } else if (ITEMS.includes(b.type) && !(current?.block.type === "numbered_list_item" && b.type === "bulleted_list_item")) {
        // Bullets right after a numbered question are part of its answer.
        flush();
        current = { block: b, extra: [] };
      } else if (current) {
        current.extra.push(b);
      }
    }
  };
  walk(blocks);
  flush();
  return { questions, skipped };
}

// Before its answer, a short line under a question is the answer itself, not a new section.
function hasAnswer({ block, extra }: { block: Block; extra: Block[] }) {
  return !!block.children?.length || !!splitInline(textOf(block))[1] || extra.some((x) => textOf(x).replace(LABEL, "").trim() || x.children?.length);
}

// A short line counts as a section title only if questions follow it.
function nextIsItem(list: Block[], b: Block) {
  const rest = list.slice(list.indexOf(b) + 1).filter((x) => !(x.type === "paragraph" && !textOf(x).trim()));
  return !!rest[0] && ITEMS.includes(rest[0].type);
}
