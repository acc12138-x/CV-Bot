import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

export function renderMarkdown(raw: string): string {
  const html = marked.parse(raw, { async: false }) as string;

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p","br","strong","em","code","pre","blockquote",
      "ul","ol","li","a","h1","h2","h3","h4","hr",
      "table","thead","tbody","tr","th","td","span",
    ],
    ALLOWED_ATTR: ["href","title","target","rel","class"],
    // 允许：http(s)、mailto、以及站内相对路径（/ 开头）
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/)/i,
  });

  // 给所有 <a> 加 target="_blank" + rel（站内链接也新窗口，方便访客回来继续问）
  return clean.replace(
    /<a\s+href="([^"]+)"/g,
    '<a href="$1" target="_blank" rel="noreferrer noopener"',
  );
}