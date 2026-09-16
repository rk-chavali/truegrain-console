/**
 * Docs: pages owned in this repository.
 *
 * The files live in docs/ as plain markdown and are pulled in at build time,
 * so editing documentation is editing a file and opening a pull request rather
 * than logging into something. That is the same argument the engine makes
 * about models, applied to its own prose.
 */

import { Link, useParams } from "react-router-dom";
import { parse, spans, type Node } from "../lib/markdown";

// Vite inlines every file matching this at build time, so the built console
// carries its own documentation and needs nothing at runtime.
const files = import.meta.glob("../../docs/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

interface Page {
  slug: string;
  title: string;
  body: Node[];
}

const PAGES: Page[] = Object.entries(files)
  .map(([path, source]) => {
    const slug = path.split("/").pop()!.replace(/^\d+-/, "").replace(/\.md$/, "");
    const first = source.split("\n").find((l) => l.startsWith("# "));
    return {
      slug,
      title: first ? first.replace(/^#\s+/, "") : slug,
      body: parse(source.replace(/^#\s+.*\n/, "")),
      order: /^\d+/.exec(path.split("/").pop()!)?.[0] ?? "99",
    };
  })
  .sort((a, b) => a.order.localeCompare(b.order))
  .map(({ slug, title, body }) => ({ slug, title, body }));

export function Docs() {
  const { slug } = useParams();
  const page = PAGES.find((p) => p.slug === slug) ?? PAGES[0];

  if (!page) {
    return (
      <div className="page">
        <section className="panel invite">
          <h2>No pages yet</h2>
          <p>Drop a markdown file into docs/ and it appears here.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page split">
      <aside className="rail">
        <h2>Documentation</h2>
        <nav className="doc-nav">
          {PAGES.map((p) => (
            <Link key={p.slug} to={`/docs/${p.slug}`} aria-current={p.slug === page.slug ? "page" : undefined}>
              {p.title}
            </Link>
          ))}
        </nav>
        <p className="note">
          These pages are markdown files in this repository. Editing one is a pull request.
        </p>
      </aside>

      <main className="panel">
        <article className="doc">
          <h1 style={{ marginTop: 0, fontSize: "1.75rem", fontWeight: 660 }}>{page.title}</h1>
          {page.body.map((node, i) => (
            <Block key={i} node={node} />
          ))}
        </article>
      </main>
    </div>
  );
}

function Block({ node }: { node: Node }) {
  if (node.kind === "code") return <pre className="code">{node.text}</pre>;
  if (node.kind === "heading") {
    return node.level === 2 ? <h2>{node.text}</h2> : <h3>{node.text}</h3>;
  }
  if (node.kind === "paragraph") return <p><Inline text={node.text} /></p>;
  if (node.kind === "list") {
    const items = node.items.map((item, i) => (
      <li key={i}>
        <Inline text={item} />
      </li>
    ));
    return node.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {node.head.map((h, i) => (
              <th key={i}>
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inline markup as elements. Nothing is ever set as raw HTML. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {spans(text).map((s, i) => {
        if (s.code) return <code key={i}>{s.text}</code>;
        if (s.strong) return <strong key={i}>{s.text}</strong>;
        if (s.href) {
          const internal = s.href.startsWith("/");
          return internal ? (
            <Link key={i} to={s.href}>
              {s.text}
            </Link>
          ) : (
            <a key={i} href={s.href} target="_blank" rel="noreferrer noopener">
              {s.text}
            </a>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}
