/**
 * Model: the catalogue, as this identity is allowed to see it.
 *
 * Each metric shows its definition and the dimensions it can legally be
 * grouped by, because those two facts are what decide whether it answers the
 * question somebody actually has. A list of names alone sends people to guess.
 */

import { useEffect, useMemo, useState } from "react";
import type { Dimension, Metric, Namespace } from "truegrain";
import { describe, useEngine } from "../lib/engine";
import { NeedsEngine } from "../components/NeedsEngine";

export function Model() {
  const engine = useEngine();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [problem, setProblem] = useState("");
  const [term, setTerm] = useState("");
  const [showing, setShowing] = useState<"metrics" | "dimensions">("metrics");

  const client = engine.client;
  useEffect(() => {
    if (!client || !engine.live) return;
    let current = true;
    Promise.all([client.metrics(), client.dimensions(), client.namespaces()])
      .then(([m, d, n]) => {
        if (!current) return;
        setMetrics(m);
        setDimensions(d);
        setNamespaces(n);
      })
      .catch((err: unknown) => current && setProblem(describe(err)));
    return () => {
      current = false;
    };
  }, [client, engine.live]);

  const lower = term.trim().toLowerCase();
  const shownMetrics = useMemo(
    () => metrics.filter((m) => !lower || m.name.toLowerCase().includes(lower) || m.description.toLowerCase().includes(lower)),
    [metrics, lower],
  );
  const shownDims = useMemo(
    () => dimensions.filter((d) => !lower || d.name.toLowerCase().includes(lower) || d.description.toLowerCase().includes(lower)),
    [dimensions, lower],
  );

  if (!engine.live) return <NeedsEngine />;

  return (
    <div className="page">
      <h1>Model</h1>
      <p className="lede">
        Everything this identity may read. A metric that is not here either does not exist or
        is not yours to see, and the engine will refuse it either way.
      </p>

      {problem && (
        <section className="panel refusal">
          <h3 className="verdict">Could not read the model</h3>
          <p className="reason">{problem}</p>
        </section>
      )}

      <section className="panel">
        <h2>Namespaces</h2>
        <p className="note" style={{ marginTop: 0, marginBottom: "0.8rem" }}>
          Each team owns its own definitions. An unavailable one is reported rather than
          hidden, so a missing metric is never mistaken for a model that never had it.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Owners</th>
                <th>Metrics</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {namespaces.map((n) => (
                <tr key={n.name}>
                  <td style={{ fontFamily: "var(--mono)" }}>{n.name}</td>
                  <td style={{ color: "var(--text-dim)" }}>{n.owners.join(", ") || "unowned"}</td>
                  <td className="num">{n.metricCount}</td>
                  <td style={{ color: n.available ? "var(--flow)" : "var(--grain)" }}>
                    {n.available ? "loaded" : n.error || "unavailable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={showing === "metrics"} onClick={() => setShowing("metrics")}>
            {metrics.length} metrics
          </button>
          <button type="button" role="tab" aria-selected={showing === "dimensions"} onClick={() => setShowing("dimensions")}>
            {dimensions.length} dimensions
          </button>
        </div>

        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={showing === "metrics" ? "Search metrics" : "Search dimensions"}
          aria-label="Search the model"
          style={{ marginBottom: "1rem" }}
        />

        {showing === "metrics"
          ? shownMetrics.map((m) => <MetricEntry key={m.name} metric={m} />)
          : shownDims.map((d) => <DimensionEntry key={d.name} dimension={d} />)}

        {(showing === "metrics" ? shownMetrics : shownDims).length === 0 && (
          <p className="note">Nothing matches {JSON.stringify(term)}.</p>
        )}
      </section>
    </div>
  );
}

function MetricEntry({ metric }: { metric: Metric }) {
  return (
    <article className="entry">
      <h3>
        <span className="ns">{metric.namespace}.</span>
        {metric.name.replace(metric.namespace + ".", "")}
      </h3>
      {metric.description && <p>{metric.description}</p>}
      {metric.definition && <code className="def">{metric.definition}</code>}
      <div className="chips">
        {metric.dimensions.length === 0 ? (
          <span className="chip">no dimensions readable by you</span>
        ) : (
          metric.dimensions.map((d) => (
            <span className="chip" key={d}>
              {d}
            </span>
          ))
        )}
      </div>
    </article>
  );
}

function DimensionEntry({ dimension }: { dimension: Dimension }) {
  return (
    <article className="entry">
      <h3>{dimension.name}</h3>
      {dimension.description && <p>{dimension.description}</p>}
      <div className="chips">
        {dimension.datatype && <span className="chip">{dimension.datatype}</span>}
        {dimension.isTime && <span className="chip time">time, bucketed by {dimension.grains.join(", ")}</span>}
        {dimension.synonyms.map((s) => (
          <span className="chip" key={s}>
            also called {s}
          </span>
        ))}
      </div>
    </article>
  );
}
