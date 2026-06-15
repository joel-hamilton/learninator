import { marked } from "marked";

export function formatMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}
