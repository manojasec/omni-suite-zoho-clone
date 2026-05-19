/**
 * Tiny rich-text helpers (zero dep). Used by the `<RichTextEditor>` component
 * to sanitise HTML before persisting and convert HTML ↔ Markdown for
 * fallback rendering.
 *
 * Design: small allowlist of inline formatting + paragraphs + lists + links.
 * Anything outside the allowlist is stripped. This keeps stored content safe
 * to render in tooltips, emails, PDFs, etc. without an HTML sanitiser dep.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "code",
  "pre",
]);

const VOID_TAGS = new Set(["br"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
};

const URL_SCHEMES = /^(https?:|mailto:|tel:|\/|#)/i;

/**
 * Sanitise HTML. Strips disallowed tags, attributes, and JS URLs. Coerces
 * `<b>`/`<i>` to `<strong>`/`<em>`. Drops empty paragraphs.
 */
export function sanitizeRichHtml(html: string): string {
  // Tokenise on tag boundaries.
  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") {
      const next = html.indexOf("<", i);
      const text = html.slice(i, next === -1 ? html.length : next);
      out.push(escapeText(text));
      if (next === -1) break;
      i = next;
      continue;
    }
    // Treat lone `<` (followed by space or non-letter/-slash/-bang) as text.
    const lookahead = html[i + 1];
    if (!lookahead || (!/[a-zA-Z!/]/.test(lookahead))) {
      out.push("&lt;");
      i++;
      continue;
    }
    const close = html.indexOf(">", i);
    if (close === -1) {
      out.push(escapeText(html.slice(i)));
      break;
    }
    const tagSrc = html.slice(i + 1, close).trim();
    i = close + 1;
    if (tagSrc.startsWith("!")) continue; // strip comments / DOCTYPE
    // Drop the entire body of <script>/<style> tags including their content.
    const blockMatch = /^(script|style)\b/i.exec(tagSrc);
    if (blockMatch) {
      const closer = new RegExp(`</${blockMatch[1]}\\s*>`, "i").exec(html.slice(i));
      if (closer) {
        i += closer.index + closer[0].length;
      } else {
        i = html.length;
      }
      continue;
    }
    if (tagSrc.startsWith("/")) {
      const name = normaliseTagName(tagSrc.slice(1));
      if (!ALLOWED_TAGS.has(name)) continue;
      // Pop matching tag from stack.
      const idx = stack.lastIndexOf(name);
      if (idx === -1) continue;
      while (stack.length > idx) {
        out.push(`</${stack.pop()}>`);
      }
      continue;
    }
    const isSelfClose = tagSrc.endsWith("/");
    const inner = isSelfClose ? tagSrc.slice(0, -1).trim() : tagSrc;
    const spaceAt = inner.search(/\s/);
    const rawName = spaceAt === -1 ? inner : inner.slice(0, spaceAt);
    const attrSrc = spaceAt === -1 ? "" : inner.slice(spaceAt + 1);
    const name = normaliseTagName(rawName);
    if (!ALLOWED_TAGS.has(name)) continue;

    const attrs = parseAttrs(attrSrc, name);
    const attrStr = attrs ? " " + attrs : "";
    if (VOID_TAGS.has(name) || isSelfClose) {
      out.push(`<${name}${attrStr} />`);
      continue;
    }
    out.push(`<${name}${attrStr}>`);
    stack.push(name);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("").replace(/<p>\s*<\/p>/g, "");
}

function normaliseTagName(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "b") return "strong";
  if (lower === "i") return "em";
  return lower;
}

function parseAttrs(src: string, tagName: string): string {
  if (!src) return "";
  const allow = ALLOWED_ATTRS[tagName];
  if (!allow) return "";
  const out: string[] = [];
  // attr="value" | attr='value' | attr=value | attr
  const re = /([a-zA-Z_:][a-zA-Z0-9_.\-:]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (!allow.has(name)) continue;
    let value = m[2] ?? "";
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1);
    if (name === "href" && !URL_SCHEMES.test(value)) continue;
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  return out.join(" ");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Convert sanitised rich HTML to Markdown (best effort, lossy). */
export function htmlToMarkdown(html: string): string {
  let s = sanitizeRichHtml(html);
  s = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<strong>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<em>(.*?)<\/em>/gis, "*$1*")
    .replace(/<u>(.*?)<\/u>/gis, "_$1_")
    .replace(/<s>(.*?)<\/s>/gis, "~~$1~~")
    .replace(/<code>(.*?)<\/code>/gis, "`$1`")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    .replace(/<h1>(.*?)<\/h1>/gis, "# $1\n\n")
    .replace(/<h2>(.*?)<\/h2>/gis, "## $1\n\n")
    .replace(/<h3>(.*?)<\/h3>/gis, "### $1\n\n")
    .replace(/<blockquote>(.*?)<\/blockquote>/gis, "> $1\n\n")
    .replace(/<li>(.*?)<\/li>/gis, "- $1\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Strip ALL tags — useful for snippet/preview text. */
export function stripRichHtml(html: string): string {
  return sanitizeRichHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
