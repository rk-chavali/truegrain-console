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

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      out.push({ kind: "heading", level: heading[1]!.length === 2 ? 2 : 3, text: heading[2]! });
      i++;
      continue;
    }

    // A table needs a header row and a divider row beneath it.
    if (line.includes("|") && lines[i + 1]?.includes("-") && lines[i + 1]?.includes("|")) {
      const cells = (row: string) =>
        row.split("|").map((c) => c.trim()).filter((c, n, all) => !(c === "" && (n === 0 || n === all.length - 1)));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|")) rows.push(cells(lines[i]!)), i++;
      out.push({ kind: "table", head, rows });
      continue;
    }

    const bullet = /^\s*([-*]|\d+\.)\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]!);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !lines[i]!.startsWith("```") && !/^#{2,3}\s/.test(lines[i]!)) {
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
