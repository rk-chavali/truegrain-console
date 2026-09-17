/**
 * Spend: what the warehouse says these queries cost.
 *
 * The number worth watching before anything is visibly wrong. A semantic layer
 * makes it very easy to ask an expensive question by accident, because the
 * person asking never sees the scan.
 *
 * One distinction runs through this screen and it is not cosmetic. **Zero
 * means not reported, never free.** DuckDB bills nobody and reports nothing;
 * BigQuery bills and says so. Rendering both as a confident 0 would tell an
 * operator on DuckDB that their queries are free, which happens to be true,
 * and an operator whose BigQuery credentials cannot read job statistics the
 * same thing, which is not. So a warehouse that reports nothing is told it
 * reports nothing.
 */

import { useMemo } from "react";
import { NeedsEngine } from "../components/NeedsEngine";
import { Refresh } from "../components/Refresh";
import { useEngine } from "../lib/engine";
import { bytes, noCostReason, useRecord } from "../lib/record";
import { RecordUnavailable } from "./Refusals";

export function Spend() {
  const engine = useEngine();
  const record = useRecord();
  // A zero means different things on different warehouses, and the screen
  // has to say which one this is rather than imply the query was free.
  const dialect = engine.health?.dialect.dialect ?? "";

  const billed = useMemo(() => record.events.filter((e) => e.bytesBilled > 0), [record.events]);
  const total = useMemo(() => billed.reduce((sum, e) => sum + e.bytesBilled, 0), [billed]);

  const byCaller = useMemo(() => group(billed, (e) => e.identity), [billed]);
  const byMetric = useMemo(
    () => group(billed.flatMap((e) => e.metrics.map((m) => ({ ...e, key: m }))), (e) => e.key),
    [billed],
  );

  // Queries that ran and reported nothing. Counted separately so the totals
  // above are not read as covering every query.
  const unreported = record.events.filter((e) => e.decision === "allowed" && e.bytesBilled === 0).length;

  if (!engine.live || engine.blocked) return <NeedsEngine />;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Spend</h1>
        <Refresh loading={record.loading} onClick={record.reload} />
      </div>
      <p className="lede">
        What the warehouse charged for the queries in the current window. Refusals cost
        nothing, because nothing reached the warehouse.
      </p>

      {record.problem && <RecordUnavailable problem={record.problem} onRetry={record.reload} />}

      {!record.problem && billed.length === 0 && (
        <section className="panel invite">
          <h2>Nothing reported a cost</h2>
          <p>
            {record.loading
              ? "Reading the record."
              : unreported > 0
                ? `${unreported} quer${unreported === 1 ? "y" : "ies"} ran and reported no cost.`
                : "No queries have run in this window."}
          </p>
          <p className="note">{noCostReason(dialect)}</p>
        </section>
      )}

      {billed.length > 0 && (
        <>
          <section className="panel total">
            <p className="figure">{bytes(total)}</p>
            <p className="note">
              billed across {billed.length} quer{billed.length === 1 ? "y" : "ies"}
              {unreported > 0 && `, with ${unreported} more that reported no cost`}
            </p>
            {unreported > 0 && <p className="note">{noCostReason(dialect)}</p>}
          </section>

          <Breakdown title="By caller" rows={byCaller} total={total} />
          <Breakdown title="By metric" rows={byMetric} total={total} />
        </>
      )}
    </div>
  );
}

interface Row {
  key: string;
  total: number;
  count: number;
}

function group<T extends { bytesBilled: number }>(events: T[], key: (e: T) => string): Row[] {
  const out = new Map<string, Row>();
  for (const e of events) {
    const k = key(e);
    const row = out.get(k) ?? { key: k, total: 0, count: 0 };
    row.total += e.bytesBilled;
    row.count += 1;
    out.set(k, row);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}

/**
 * A bar per row, because the question is always which one is the outlier and
 * a column of numbers makes that a reading exercise.
 */
function Breakdown({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  if (rows.length === 0) return null;
  const largest = rows[0]?.total ?? 1;

  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul className="bars">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="bar-label">
              <code>{row.key}</code>
              <span className="note">
                {bytes(row.total)} · {Math.round((row.total / total) * 100)}% · {row.count} quer
                {row.count === 1 ? "y" : "ies"}
              </span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${Math.max(2, (row.total / largest) * 100)}%` }}
                role="img"
                aria-label={`${bytes(row.total)} of ${bytes(total)}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
