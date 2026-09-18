/**
 * A small markdown renderer.
 *
 * Deliberately not a dependency. The docs in this repository are written by
 * the people who own this console, so the input is trusted and the subset
 * needed is small: headings, paragraphs, lists, fenced code, inline code,
 * links and tables. A parser library would be a larger surface than the
 * feature, and this console's whole argument is that it installs cleanly.
 *
 * It returns structured nodes rather than an HTML string, so React renders
 * them as elements and nothing is ever passed through dangerouslySetInnerHTML.
 */

export type Node =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

const BULLET = /^\s*([-*]|\d+\.)\s+/;
const HEADING = /^(#{2,3})\s+(.*)$/;

/** A table needs a header row and a divider row beneath it. */
function startsTable(line: string, next: string | undefined): boolean {
  return line.includes("|") && !!next && next.includes("-") && next.includes("|");
}

/**
 * Does this line begin a block that a paragraph must not swallow?
 *
 * Markdown does not require a blank line before a list or a table, and nobody
 * writing prose leaves one. Without this the bullets are absorbed into the
 * paragraph above and render as one run-on sentence with stray hyphens in it,
 * which is what `docs/04-deploying.md` did to its two deployment options.
 */
function startsBlock(line: string, next: string | undefined): boolean {
  return line.startsWith("```") || HEADING.test(line) || BULLET.test(line) || startsTable(line, next);
}

export function parse(source: string): Node[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i]!), i++;
      i++; // closing fence
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ kind: "heading", level: heading[1]!.length === 2 ? 2 : 3, text: heading[2]! });
      i++;
      continue;
    }

    if (startsTable(line, lines[i + 1])) {
      const cells = (row: string) =>
        row.split("|").map((c) => c.trim()).filter((c, n, all) => !(c === "" && (n === 0 || n === all.length - 1)));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|")) rows.push(cells(lines[i]!)), i++;
      out.push({ kind: "table", head, rows });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]!);
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i]!)) {
        items.push(lines[i]!.replace(BULLET, ""));
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() !== "" && !startsBlock(lines[i]!, lines[i + 1])) {
      paragraph.push(lines[i]!);
      i++;
    }
    out.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return out;
}

export type Span = { text: string; code?: boolean; href?: string; strong?: boolean };

/** Split inline markup into spans, so React can render each as an element. */
export function spans(text: string): Span[] {
  const out: Span[] = [];
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const token = m[0]!;
    if (token.startsWith("`")) {
      out.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith("[")) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!;
      out.push({ text: link[1]!, href: link[2]! });
    } else {
      out.push({ text: token.slice(2, -2), strong: true });
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
