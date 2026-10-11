// Bulk import format: questions separated by a line of "---".
// In each block the first line is the question, the rest is the reference answer.
export function parseQuestionBlocks(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/^\s*-{3,}\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      return {
        text: first.replace(/^(в|вопрос|q)\s*[:.]\s*/i, "").trim(),
        referenceAnswer: rest.join("\n").replace(/^\s*(о|ответ|a)\s*[:.]\s*/i, "").trim(),
      };
    })
    .filter((q) => q.text && q.referenceAnswer);
}
