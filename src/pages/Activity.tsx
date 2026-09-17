/**
 * Activity: the audit log, made readable.
 *
 * The engine has always written this and nothing has ever read it. Answering
 * "who queried what, and what happened" previously meant shelling into the
 * container and reading JSON lines.
 *
 * The five decisions are kept apart rather than reduced to worked or did not,
 * because the difference between them is the difference between an access
 * problem, a modelling problem and an outage. Colour follows: teal for
 * answered, amber for refused, edge grey for denied, dim for compiled, and
 * only a genuine failure gets treated as a failure.
 */

import { useMemo, useState } from "react";
import type { AuditEvent } from "truegrain";
import { NeedsEngine } from "../components/NeedsEngine";
import { Refresh } from "../components/Refresh";
import { useEngine } from "../lib/engine";
import { bytes, exactly, useRecord, when } from "../lib/record";
import { RecordUnavailable } from "./Refusals";

const DECISIONS = ["allowed", "refused", "denied", "compiled", "error"] as const;

/** What each decision means, in the reader's terms rather than the engine's. */
const MEANING: Record<string, string> = {
  allowed: "ran, and returned rows",
  refused: "could not be answered accurately",
  denied: "this caller may not read a field",
  compiled: "the SQL was read without running it",
  error: "the warehouse or the engine broke",
};

export function Activity() {
  const engine = useEngine();
  const record = useRecord();
  const [decision, setDecision] = useState("");
  const [who, setWho] = useState("");

  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const e of record.events) out.set(e.decision, (out.get(e.decision) ?? 0) + 1);
    return out;
  }, [record.events]);

  const callers = useMemo(() => {
    const out = new Set<string>();
    for (const e of record.events) out.add(e.identity);
    return [...out].sort();
  }, [record.events]);

  const shown = record.events.filter(
    (e) => (!decision || e.decision === decision) && (!who || e.identity === who),
  );

  if (!engine.live || engine.blocked) return <NeedsEngine />;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Activity</h1>
        <Refresh loading={record.loading} onClick={record.reload} />
      </div>
      <p className="lede">
        Every decision this engine made, newest first. A window held in memory, not the
        whole record: an engine started with <code>-audit</code> keeps everything in that
        file.
      </p>

      {record.problem && <RecordUnavailable problem={record.problem} onRetry={record.reload} />}

      {!record.problem && record.events.length === 0 && (
        <section className="panel invite">
          <h2>Nothing recorded yet</h2>
          <p>
            {record.loading ? "Reading the record." : "Run a query from Explore and it will appear here."}
          </p>
        </section>
      )}

      {record.events.length > 0 && (
        <>
          <div className="tabs" role="tablist" aria-label="Filter by decision">
            <button type="button" role="tab" aria-selected={decision === ""} onClick={() => setDecision("")}>
              all {record.events.length}
            </button>
            {DECISIONS.filter((d) => counts.has(d)).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={decision === d}
                onClick={() => setDecision(d)}
                title={MEANING[d]}
              >
                {d} {counts.get(d)}
              </button>
            ))}
          </div>

          {callers.length > 1 && (
            <label className="caller-filter">
              <span className="note">Caller</span>
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">everyone</option>
                {callers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <section className="panel">
            <table className="record">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Decision</th>
                  <th>Asked for</th>
                  <th className="num">Rows</th>
                  <th className="num">Took</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => (
                  <Row key={`${e.time}-${i}`} event={e} />
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p className="note">Nothing matches that filter.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Row({ event }: { event: AuditEvent }) {
  const asked = [...event.metrics];
  if (event.dimensions.length > 0) asked.push(`by ${event.dimensions.join(", ")}`);

  return (
    <tr>
      <td title={exactly(event.time)}>{when(event.time)}</td>
      <td className="who">{event.identity}</td>
      <td>
        <span className={`decision decision-${event.decision}`}>{event.decision}</span>
        {event.code && <code className="tiny">{event.code}</code>}
      </td>
      <td>
        {asked.length > 0 ? <code className="tiny">{asked.join(" ")}</code> : <span className="note">-</span>}
        {/* Denied fields are recorded but were never shown to the caller who
            was denied. An operator reading this screen is allowed to know. */}
        {event.deniedFields.length > 0 && (
          <div className="note">withheld: {event.deniedFields.join(", ")}</div>
        )}
      </td>
      <td className="num">{event.decision === "allowed" ? event.rowCount : ""}</td>
      <td className="num" title={event.bytesBilled > 0 ? `${bytes(event.bytesBilled)} billed` : ""}>
        {event.durationMs > 0 ? `${event.durationMs} ms` : ""}
      </td>
    </tr>
  );
}
