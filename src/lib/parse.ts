// Bulk import format: questions separated by a line of "---".
// In each block the first line is the question, the rest is the reference answer.
// A line "# Раздел" at the start of a block sets the section for that block and all following ones.
export function parseQuestionBlocks(raw: string) {
  let section: string | undefined;
  return raw
    .replace(/\r\n/g, "\n")
    .split(/^\s*-{3,}\s*$/m)
    .map((block) => {
      const lines = block.trim().split("\n");
      while (lines.length && /^#+\s/.test(lines[0])) {
        section = lines.shift()!.replace(/^#+\s*/, "").trim();
        while (lines.length && !lines[0].trim()) lines.shift();
      }
      const [first = "", ...rest] = lines;
      return {
        section,
        text: first.replace(/^(в|вопрос|q)\s*[:.]\s*/i, "").trim(),
        referenceAnswer: rest.join("\n").replace(/^\s*(о|ответ|a)\s*[:.]\s*/i, "").trim(),
      };
    })
    .filter((q) => q.text && q.referenceAnswer);
}
