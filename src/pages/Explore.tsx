/**
 * Explore: ask the engine a question and read what it says back.
 *
 * The hero is the refusal. When a question would return a plausible wrong
 * number the engine declines, and this page gives that the most typographic
 * weight on the screen, shows the grain levels involved, and states that no
 * SQL exists rather than leaving an empty panel for the reader to interpret.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Refused, type Dimension, type Metric, type Result } from "truegrain";
import { describe, useEngine } from "../lib/engine";
import { GrainStack } from "../components/GrainStack";
import { NeedsEngine } from "../components/NeedsEngine";

type Tab = "result" | "sql" | "code";
type Lang = "curl" | "python" | "typescript" | "go";

interface Condition {
  dimension: string;
  op: string;
  values: string[];
}

const OP_LABELS: Record<string, string> = {
  eq: "is",
  ne: "is not",
  in: "is one of",
  not_in: "is none of",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  is_null: "is empty",
  is_not_null: "is not empty",
};

const arity = (op: string) => (op === "between" ? 2 : op === "is_null" || op === "is_not_null" ? 0 : 1);
const tail = (q: string) => (q.includes(".") ? q.split(".").slice(1).join(".") : q);
const head = (q: string) => (q.includes(".") ? q.split(".")[0]! : "");
/** `sales.orders.order_date` names the dataset `orders`. */
const datasetOf = (q: string) => {
  const parts = q.split(".");
  return parts.length >= 3 ? parts[1]! : parts.length === 2 ? parts[0]! : q;
};

export function Explore() {
  const engine = useEngine();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [chosenMetrics, setChosenMetrics] = useState<string[]>([]);
  const [chosenDims, setChosenDims] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [grain, setGrain] = useState("");
  const [search, setSearch] = useState({ metrics: "", dimensions: "" });
  const [tab, setTab] = useState<Tab>("result");
  const [lang, setLang] = useState<Lang>("curl");

  const [result, setResult] = useState<Result | null>(null);
  const [refusal, setRefusal] = useState<Refused | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const client = engine.client;

  // Load the model once there is an engine to read it from.
  useEffect(() => {
    if (!client || !engine.live || engine.blocked) return;
    let current = true;
    Promise.all([client.metrics(), client.dimensions()])
      .then(([m, d]) => {
        if (!current) return;
        setMetrics(m);
        setDimensions(d);
        // Land on a question that works, so the first thing anyone sees is the
        // engine answering. Finding a refusal is then one click away, which
        // demonstrates more than being shown one.
        if (m.length > 0 && chosenMetrics.length === 0) setChosenMetrics([m[0]!.name]);
      })
      .catch((err: unknown) => current && setProblem(describe(err)));
    return () => {
      current = false;
    };
    // chosenMetrics is deliberately not a dependency: this seeds it once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, engine.live, engine.blocked]);

  const legalDims = useMemo(() => {
    if (chosenMetrics.length === 0) return [];
    const allowed = new Set<string>();
    for (const m of metrics) {
      if (chosenMetrics.includes(m.name)) for (const d of m.dimensions) allowed.add(d);
    }
    return dimensions.filter((d) => allowed.has(d.name));
  }, [metrics, dimensions, chosenMetrics]);

  // Dropping a metric can strand a dimension or a condition that is no longer
  // legal for what remains. Left in the request they produce a refusal about a
  // field the page no longer shows, which nobody can act on.
  useEffect(() => {
    const legal = new Set(legalDims.map((d) => d.name));
    setChosenDims((prev) => prev.filter((n) => legal.has(n)));
    setConditions((prev) => prev.filter((c) => legal.has(c.dimension)));
  }, [legalDims]);

  const timeChosen = chosenDims.some((n) => dimensions.find((d) => d.name === n)?.isTime);
  useEffect(() => {
    if (!timeChosen && grain) setGrain("");
  }, [timeChosen, grain]);

  const request = useMemo(() => {
    const req: Record<string, unknown> = { metrics: chosenMetrics, limit: 200 };
    if (chosenDims.length) req.dimensions = chosenDims;
    if (grain) req.grain = grain;
    const wired = conditions
      .filter((c) => arity(c.op) === 0 || c.values.every((v) => v !== ""))
      .map((c) => {
        const out: Record<string, unknown> = { dimension: c.dimension, op: c.op };
        if (arity(c.op) > 0) {
          out.values = c.values.map((v) => (v !== "" && !isNaN(Number(v)) ? Number(v) : v));
        }
        return out;
      });
    if (wired.length) req.filters = wired;
    return req;
  }, [chosenMetrics, chosenDims, grain, conditions]);

  const run = useCallback(async () => {
    if (!client || chosenMetrics.length === 0) {
      setResult(null);
      setRefusal(null);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    try {
      const out = await client.query(request as never);
      if (mine !== seq.current) return;
      setResult(out);
      setRefusal(null);
      setProblem("");
    } catch (err) {
      if (mine !== seq.current) return;
      setResult(null);
      if (err instanceof Refused) {
        setRefusal(err);
        setProblem("");
      } else {
        setRefusal(null);
        setProblem(describe(err));
      }
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, [client, chosenMetrics.length, request]);

  useEffect(() => {
    void run();
  }, [run]);

  if (!engine.live || engine.blocked) return <NeedsEngine />;

  const levels = levelsFor(chosenDims, legalDims, refusal);
  const matches = (name: string, text: string, term: string) =>
    !term || name.toLowerCase().includes(term) || text.toLowerCase().includes(term);

  return (
    <div className="page split">
      <aside className="rail">
        <section>
          <h2>Measure</h2>
          <input
            type="search"
            aria-label="Search metrics"
            placeholder="Search metrics"
            value={search.metrics}
            onChange={(e) => setSearch((s) => ({ ...s, metrics: e.target.value.toLowerCase() }))}
            style={{ marginBottom: "0.7rem" }}
          />
          {metrics
            .filter((m) => matches(m.name, m.description, search.metrics))
            .map((m) => (
              <Pick
                key={m.name}
                name={m.name}
                title={m.description}
                checked={chosenMetrics.includes(m.name)}
                onToggle={(on) =>
                  setChosenMetrics((prev) => (on ? [...prev, m.name] : prev.filter((x) => x !== m.name)))
                }
              />
            ))}
        </section>

        <section>
          <h2>Broken down by</h2>
          <input
            type="search"
            aria-label="Search dimensions"
            placeholder="Search dimensions"
            value={search.dimensions}
            onChange={(e) => setSearch((s) => ({ ...s, dimensions: e.target.value.toLowerCase() }))}
            style={{ marginBottom: "0.7rem" }}
          />
          {legalDims
            .filter((d) => matches(d.name, d.description, search.dimensions))
            .map((d) => (
              <Pick
                key={d.name}
                name={d.name}
                title={d.description}
                checked={chosenDims.includes(d.name)}
                onToggle={(on) =>
                  setChosenDims((prev) => (on ? [...prev, d.name] : prev.filter((x) => x !== d.name)))
                }
              />
            ))}
          <p className="note">
            {chosenMetrics.length === 0
              ? "Choose something to measure first."
              : `${legalDims.length} legal for what you picked.`}
          </p>
        </section>

        {timeChosen && (
          <section>
            <h2>Time bucket</h2>
            <select value={grain} onChange={(e) => setGrain(e.target.value)} aria-label="Time bucket">
              <option value="">none</option>
              {(engine.health?.supportedGrains ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </section>
        )}

        <section>
          <h2>Only rows where</h2>
          <Conditions
            conditions={conditions}
            setConditions={setConditions}
            legal={legalDims}
            ops={engine.health?.supportedFilterOps ?? Object.keys(OP_LABELS)}
          />
          <p className="note">A condition is a value, never SQL text.</p>
        </section>
      </aside>

      <main aria-live="polite">
        <GrainStack
          levels={levels.names}
          inflating={levels.inflating}
          active={chosenMetrics.length > 0}
        />

        {problem && (
          <section className="panel refusal">
            <h3 className="verdict">The engine did not answer</h3>
            <p className="reason">{problem}</p>
          </section>
        )}

        {refusal && <RefusalPanel refusal={refusal} asked={asked(chosenMetrics, chosenDims, grain)} />}

        {result && (
          <ResultPanels
            result={result}
            asked={asked(chosenMetrics, chosenDims, grain)}
            tab={tab}
            setTab={setTab}
            lang={lang}
            setLang={setLang}
            request={request}
            engineUrl={engine.url}
            busy={busy}
          />
        )}

        {!result && !refusal && !problem && chosenMetrics.length === 0 && (
          <section className="panel invite">
            <h2>Choose something to measure</h2>
            <p>Pick a metric on the left. The engine compiles the SQL and runs it.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function Pick({
  name,
  title,
  checked,
  onToggle,
}: {
  name: string;
  title: string;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label className="pick" title={title || undefined}>
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span className="label">
        <span className="ns">{head(name)} </span>
        {tail(name)}
      </span>
    </label>
  );
}

/**
 * A condition is assembled from a field, an operator and a value.
 *
 * There is no input here that accepts a fragment of SQL, because the engine
 * has no endpoint that would take one. That is what keeps an ungoverned
 * predicate inexpressible from this surface too.
 */
function Conditions({
  conditions,
  setConditions,
  legal,
  ops,
}: {
  conditions: Condition[];
  setConditions: (fn: (prev: Condition[]) => Condition[]) => void;
  legal: Dimension[];
  ops: string[];
}) {
  const update = (i: number, patch: Partial<Condition>) =>
    setConditions((prev) => prev.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  return (
    <>
      {conditions.map((c, i) => (
        <div className="filter" key={i}>
          <span className="on">where</span>
          <select
            aria-label="Field"
            value={c.dimension}
            onChange={(e) => update(i, { dimension: e.target.value })}
          >
            {legal.map((d) => (
              <option key={d.name} value={d.name}>
                {tail(d.name)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="drop"
            aria-label="Remove this condition"
            onClick={() => setConditions((prev) => prev.filter((_, n) => n !== i))}
          >
            ×
          </button>
          <select
            aria-label="Comparison"
            value={c.op}
            onChange={(e) =>
              update(i, { op: e.target.value, values: Array(arity(e.target.value)).fill("") })
            }
          >
            {ops.map((op) => (
              <option key={op} value={op}>
                {OP_LABELS[op] ?? op}
              </option>
            ))}
          </select>
          {Array.from({ length: arity(c.op) }, (_, v) => (
            <input
              key={v}
              type="text"
              aria-label="Value"
              placeholder={c.op === "between" ? (v === 0 ? "from" : "to") : "value"}
              value={c.values[v] ?? ""}
              onChange={(e) =>
                update(i, { values: c.values.map((old, n) => (n === v ? e.target.value : old)) })
              }
            />
          ))}
        </div>
      ))}
      <button
        type="button"
        className="add-filter"
        disabled={legal.length === 0}
        onClick={() =>
          setConditions((prev) => [...prev, { dimension: legal[0]!.name, op: "eq", values: [""] }])
        }
      >
        Add a condition
      </button>
    </>
  );
}

function RefusalPanel({ refusal, asked }: { refusal: Refused; asked: string }) {
  return (
    <>
      <section className="panel refusal">
        <p style={{ fontSize: "1.5rem", fontWeight: 620, margin: "0 0 1.1rem", letterSpacing: "-0.024em" }}>
          {asked}
        </p>
        <h3 className="verdict">{headline(refusal.code)}</h3>
        <p className="reason">{refusal.reason}</p>
        {refusal.hint && (
          <div className="todo">
            <h4>What to do</h4>
            <p>{refusal.hint}</p>
          </div>
        )}
      </section>
      <section className="panel">
        <h3>The SQL it compiled</h3>
        <p className="absent">
          None. The engine decides before it emits SQL, so there is no statement to run, no
          warehouse job to cancel, and nothing to leak.
        </p>
      </section>
    </>
  );
}

function ResultPanels({
  result,
  asked,
  tab,
  setTab,
  lang,
  setLang,
  request,
  engineUrl,
  busy,
}: {
  result: Result;
  asked: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  request: Record<string, unknown>;
  engineUrl: string;
  busy: boolean;
}) {
  return (
    <>
      <section className="panel">
        <p style={{ fontSize: "1.5rem", fontWeight: 620, margin: "0 0 1.1rem", letterSpacing: "-0.024em" }}>
          {asked}
        </p>
        <div className="tabs" role="tablist">
          {(["result", "sql", "code"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {id === "result" ? "Result" : id === "sql" ? "SQL" : "Code"}
            </button>
          ))}
        </div>

        {tab === "sql" && (
          <>
            <pre className="code">{result.compiledSql}</pre>
            <p className="meta">
              {result.dialect} {result.modelVersion}
            </p>
          </>
        )}

        {tab === "code" && <CodeExport request={request} engineUrl={engineUrl} lang={lang} setLang={setLang} />}

        {tab === "result" && (
          <>
            <h3>
              {result.rowCount} {result.rowCount === 1 ? "row" : "rows"} from the warehouse
              {busy ? ", refreshing" : ""}
            </h3>
            {result.rowCount === 1 && result.columns.length === 1 ? (
              <p className="total">{String(result.rows[0]![0])}</p>
            ) : result.rowCount > 0 ? (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => {
                          const numeric = cell !== null && cell !== "" && !isNaN(Number(cell));
                          return (
                            <td key={j} className={numeric ? "num" : undefined}>
                              {cell === null ? "null" : String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="note">No rows matched. That is an answer, not a refusal.</p>
            )}
            <p className="meta">
              {result.dialect} {result.modelVersion}
            </p>
          </>
        )}
      </section>
    </>
  );
}

/**
 * The same question, from each published client.
 *
 * Someone evaluating this has already decided whether they trust the answer.
 * The next thing they need is the few lines that get it from their own code,
 * and copying it from here beats reconstructing it from a reference.
 */
function CodeExport({
  request,
  engineUrl,
  lang,
  setLang,
}: {
  request: Record<string, unknown>;
  engineUrl: string;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = snippet(lang, request, engineUrl);

  return (
    <>
      <div className="tabs">
        {(["curl", "python", "typescript", "go"] as Lang[]).map((l) => (
          <button key={l} type="button" aria-selected={l === lang} onClick={() => setLang(l)}>
            {l}
          </button>
        ))}
      </div>
      <pre className="code">{text}</pre>
      <button
        type="button"
        className="btn"
        style={{ marginTop: "0.7rem" }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          } catch {
            // Clipboard access can be refused; the text is selectable either way.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </>
  );
}

const PY = { eq: "eq", ne: "ne", in: "in_", not_in: "not_in", gt: "gt", gte: "gte", lt: "lt", lte: "lte", between: "between", is_null: "is_null", is_not_null: "is_not_null" } as Record<string, string>;
const TS = { eq: "eq", ne: "ne", in: "isIn", not_in: "notIn", gt: "gt", gte: "gte", lt: "lt", lte: "lte", between: "between", is_null: "isNull", is_not_null: "isNotNull" } as Record<string, string>;
const GO = { eq: "Eq", ne: "Ne", in: "In", not_in: "NotIn", gt: "Gt", gte: "Gte", lt: "Lt", lte: "Lte", between: "Between", is_null: "IsNull", is_not_null: "IsNotNull" } as Record<string, string>;

function snippet(lang: Lang, req: Record<string, unknown>, url: string): string {
  const j = (v: unknown) => JSON.stringify(v);
  const list = (xs: unknown) => ((xs as string[]) ?? []).map(j).join(", ");
  const filters = req.filters as Array<{ dimension: string; op: string; values?: unknown[] }> | undefined;
  const args = (f: { dimension: string; values?: unknown[] }) =>
    [j(f.dimension), ...(f.values ?? []).map(j)].join(", ");

  if (lang === "curl") {
    return [
      `curl ${url}/v1/query \\`,
      `  -H 'Authorization: Bearer $SEMANTIC_TOKEN' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${JSON.stringify(req)}'`,
    ].join("\n");
  }

  if (lang === "python") {
    const lines = [
      filters ? "from truegrain import Client, filters" : "from truegrain import Client",
      "",
      "client = Client.from_env()",
      "result = client.run(",
      `    metrics=[${list(req.metrics)}],`,
    ];
    if (req.dimensions) lines.push(`    dimensions=[${list(req.dimensions)}],`);
    if (req.grain) lines.push(`    grain=${j(req.grain)},`);
    if (filters) {
      lines.push("    filters=[");
      for (const f of filters) lines.push(`        filters.${PY[f.op] ?? f.op}(${args(f)}),`);
      lines.push("    ],");
    }
    lines.push(")", "print(result.to_dataframe())");
    return lines.join("\n");
  }

  if (lang === "typescript") {
    const lines = [
      filters ? 'import { Client, filters } from "truegrain";' : 'import { Client } from "truegrain";',
      "",
      "const client = Client.fromEnv();",
      "const result = await client.run({",
      `  metrics: [${list(req.metrics)}],`,
    ];
    if (req.dimensions) lines.push(`  dimensions: [${list(req.dimensions)}],`);
    if (req.grain) lines.push(`  grain: ${j(req.grain)},`);
    if (filters) {
      lines.push("  filters: [");
      for (const f of filters) lines.push(`    filters.${TS[f.op] ?? f.op}(${args(f)}),`);
      lines.push("  ],");
    }
    lines.push("});", "console.table(result.toObjects());");
    return lines.join("\n");
  }

  const lines = [
    "client, _ := truegrain.FromEnv()",
    "",
    "result, err := client.Run(ctx, truegrain.Request{",
    `\tMetrics:    []string{${list(req.metrics)}},`,
  ];
  if (req.dimensions) lines.push(`\tDimensions: []string{${list(req.dimensions)}},`);
  if (req.grain) lines.push(`\tGrain:      ${j(req.grain)},`);
  if (filters) {
    lines.push("\tFilters: []truegrain.Filter{");
    for (const f of filters) lines.push(`\t\ttruegrain.${GO[f.op] ?? f.op}(${args(f)}),`);
    lines.push("\t},");
  }
  lines.push("})");
  return lines.join("\n");
}

function asked(metrics: string[], dims: string[], grain: string): string {
  let text = metrics.map(tail).join(", ");
  if (dims.length) text += " by " + dims.map(tail).join(", ");
  if (grain) text += `, by ${grain}`;
  return text;
}

function headline(code: string): string {
  switch (code) {
    case "fan_out_would_inflate":
      return "This would have overstated the total";
    case "access_denied":
      return "You may not read this";
    case "cross_namespace_query":
      return "That field belongs to another team";
    case "unknown_metric":
    case "unknown_dimension":
      return "No such name in this model";
    case "query_scans_too_much":
      return "This would scan more than the limit allows";
    default:
      return "Refused";
    }
}

/**
 * Which grain levels to draw.
 *
 * A refusal names both the level the metric aggregates over and the one that
 * repeats it, and both have to be on the stack or there is nothing to compare
 * the multiplication against. Taking the names from the engine's own sentence
 * keeps the picture honest rather than guessing at the model's shape.
 */
function levelsFor(
  chosenDims: string[],
  legal: Dimension[],
  refusal: Refused | null,
): { names: string[]; inflating: string | null } {
  const names: string[] = [];
  const add = (n: string) => {
    if (n && !names.includes(n)) names.push(n);
  };
  for (const d of chosenDims) add(datasetOf(d));

  let inflating: string | null = null;
  if (refusal?.reason) {
    const known = new Set(legal.map((d) => datasetOf(d.name)));
    for (const n of known) if (refusal.reason.includes(n)) add(n);
    const culprit = /:\s*([a-z0-9_]+) is not unique/i.exec(refusal.reason);
    if (culprit && known.has(culprit[1]!)) inflating = culprit[1]!;
  }

  if (names.length === 0) for (const d of legal.slice(0, 3)) add(datasetOf(d.name));

  // Coarse on top, the level that repeats underneath it, so the stack reads
  // the way the join does.
  names.sort((a, b) => (a === inflating ? 1 : 0) - (b === inflating ? 1 : 0));
  return { names, inflating };
}
