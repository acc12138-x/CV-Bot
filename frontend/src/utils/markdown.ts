import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(raw: string): string {
  const html = marked.parse(raw, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p","br","strong","em","code","pre","blockquote",
      "ul","ol","li","a","h1","h2","h3","h4","hr",
      "table","thead","tbody","tr","th","td","span",
    ],
    ALLOWED_ATTR: ["href","title","target","rel","class"],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  });
}
