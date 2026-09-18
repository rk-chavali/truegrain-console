import { describe, expect, it } from "vitest";
import { parse, spans } from "./markdown";

/**
 * The docs screen renders this console's own documentation, and the parser is
 * hand written rather than a dependency. That is the right call for a trusted
 * build-time input, but it means the correctness is ours, and a parser is
 * where a silent bug lives longest: a mis-parsed page still renders, just
 * wrongly, and nobody reading it knows what they are missing.
 */

describe("block structure", () => {
  it("reads a heading and its paragraph as separate blocks", () => {
    expect(parse("## Running\nStart the engine.")).toEqual([
      { kind: "heading", level: 2, text: "Running" },
      { kind: "paragraph", text: "Start the engine." },
    ]);
  });

  it("keeps a fenced block's contents verbatim", () => {
    // Indentation and blank lines inside a fence are the content. A parser
    // that trims them turns a copy-paste command into one that fails.
    const source = "```bash\ntruegrain init \\\n  -dataset main\n```";
    expect(parse(source)).toEqual([
      { kind: "code", text: "truegrain init \\\n  -dataset main" },
    ]);
  });

  it("does not treat a heading inside a fence as a heading", () => {
    expect(parse("```\n## not a heading\n```")).toEqual([
      { kind: "code", text: "## not a heading" },
    ]);
  });

  it("reads a table with its header and rows", () => {
    const source = "| Command | Reaches |\n|---|---|\n| validate | nothing |\n| query | rows |";
    expect(parse(source)).toEqual([
      {
        kind: "table",
        head: ["Command", "Reaches"],
        rows: [
          ["validate", "nothing"],
          ["query", "rows"],
        ],
      },
    ]);
  });

  it("reads both kinds of list", () => {
    expect(parse("- one\n- two")).toEqual([
      { kind: "list", ordered: false, items: ["one", "two"] },
    ]);
    expect(parse("1. first\n2. second")).toEqual([
      { kind: "list", ordered: true, items: ["first", "second"] },
    ]);
  });

  it("joins a wrapped paragraph into one line", () => {
    // Source wrapped at 80 columns must not render as a column of fragments.
    expect(parse("A sentence that was\nwrapped in the source.")).toEqual([
      { kind: "paragraph", text: "A sentence that was wrapped in the source." },
    ]);
  });

  it("starts a list that follows a paragraph without a blank line", () => {
    // Markdown does not require the blank line, and a writer will not leave
    // one. Swallowing the bullets into the paragraph loses the list entirely.
    expect(parse("Three identities:\n- ci\n- engine")).toEqual([
      { kind: "paragraph", text: "Three identities:" },
      { kind: "list", ordered: false, items: ["ci", "engine"] },
    ]);
  });

  it("starts a table that follows a paragraph without a blank line", () => {
    expect(parse("Which commands:\n| a | b |\n|---|---|\n| 1 | 2 |")).toEqual([
      { kind: "paragraph", text: "Which commands:" },
      { kind: "table", head: ["a", "b"], rows: [["1", "2"]] },
    ]);
  });

  it("ends a paragraph at a fence with no blank line between them", () => {
    expect(parse("Run this:\n```\ntruegrain init\n```")).toEqual([
      { kind: "paragraph", text: "Run this:" },
      { kind: "code", text: "truegrain init" },
    ]);
  });

  it("does not read prose containing a pipe as a table", () => {
    expect(parse("Pipe stdout | to a file.\nIt is still prose.")).toEqual([
      { kind: "paragraph", text: "Pipe stdout | to a file. It is still prose." },
    ]);
  });

  it("survives an unterminated fence rather than looping", () => {
    expect(parse("```\nno closing fence")).toEqual([
      { kind: "code", text: "no closing fence" },
    ]);
  });

  it("reads CRLF the same as LF", () => {
    expect(parse("## Title\r\nText.")).toEqual(parse("## Title\nText."));
  });
});

describe("inline markup", () => {
  it("splits code, links and bold out of surrounding text", () => {
    expect(spans("Run `init` then read [the docs](/docs) for **why**.")).toEqual([
      { text: "Run " },
      { text: "init", code: true },
      { text: " then read " },
      { text: "the docs", href: "/docs" },
      { text: " for " },
      { text: "why", strong: true },
      { text: "." },
    ]);
  });

  it("leaves plain text as a single span", () => {
    expect(spans("Nothing special here.")).toEqual([{ text: "Nothing special here." }]);
  });

  it("does not read markup inside a code span", () => {
    // `**not bold**` is an example of syntax, not an instruction to bold it.
    expect(spans("`**not bold**`")).toEqual([{ text: "**not bold**", code: true }]);
  });

  it("keeps an external link whole", () => {
    expect(spans("[site](https://example.com/a?b=c)")).toEqual([
      { text: "site", href: "https://example.com/a?b=c" },
    ]);
  });
});

/**
 * The docs this console actually ships, parsed.
 *
 * The unit tests above cover constructs in isolation. This one catches the
 * case that reached production: `04-deploying.md` had a list directly under a
 * paragraph, the parser swallowed it, and the page rendered two deployment
 * options as one run-on sentence with stray hyphens. Everything still built
 * and every test passed, because nothing read the real files.
 */
describe("the shipped documentation", () => {
  const docs = import.meta.glob("../../docs/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("ships some", () => {
    expect(Object.keys(docs).length).toBeGreaterThan(0);
  });

  for (const [path, source] of Object.entries(docs)) {
    describe(path, () => {
      const nodes = parse(source);

      it("parses into blocks", () => {
        expect(nodes.length).toBeGreaterThan(0);
      });

      it("has no list absorbed into a paragraph", () => {
        const swallowed = nodes.filter(
          (n) => n.kind === "paragraph" && /\s[-*]\s/.test(n.text),
        );
        expect(swallowed).toEqual([]);
      });

      it("closes every fence", () => {
        // An unterminated fence silently eats the rest of the page.
        const fences = source.split("\n").filter((l) => l.startsWith("```")).length;
        expect(fences % 2).toBe(0);
      });

      it("has no empty heading or table cell count mismatch", () => {
        for (const node of nodes) {
          if (node.kind === "heading") expect(node.text.trim()).not.toBe("");
          if (node.kind === "table") {
            for (const row of node.rows) expect(row.length).toBe(node.head.length);
          }
        }
      });
    });
  }
});
