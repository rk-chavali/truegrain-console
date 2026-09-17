/**
 * Refusals: the questions this engine declined to answer.
 *
 * The screen nobody else can have, because no other semantic layer refuses.
 * Everything about the layout is arranged so a refusal reads as the engine
 * working rather than as a failure, because that is what it is: it found a
 * question it could not answer accurately and said so, instead of returning a
 * number somebody would have put in a board pack.
 *
 * Two decisions carry that.
 *
 * The reason and the hint sit side by side with equal weight. A refusal that
 * only says no is an error message; a refusal that names what does answer the
 * question is a correction, and the layout should not bury the half that
 * helps.
 *
 * Nothing here is red. Amber throughout, the same colour the rest of the
 * console gives a refusal, because red would teach an operator to treat a
 * healthy engine as an incident and then to stop looking.
 */

import { useMemo, useState } from "react";
import type { AuditEvent } from "truegrain";
import { NeedsEngine } from "../components/NeedsEngine";
import { Refresh } from "../components/Refresh";
import { useEngine } from "../lib/engine";
import { exactly, refusals, retryMeaning, useRecord, when } from "../lib/record";

export function Refusals() {
  const engine = useEngine();
  const record = useRecord();
  const [code, setCode] = useState("");

  const declined = useMemo(() => refusals(record.events), [record.events]);

  // Grouped by code so an operator sees which refusal is happening rather than
  // reading a list of near-identical entries.
  const byCode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of declined) {
      counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [declined]);

  const shown = code ? declined.filter((e) => e.code === code) : declined;

  if (!engine.live || engine.blocked) return <NeedsEngine />;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Refusals</h1>
        <Refresh loading={record.loading} onClick={record.reload} />
      </div>
      <p className="lede">
        Questions this engine declined rather than answer with a number that would have
        been wrong. Each one names what went wrong and what answers it instead.
      </p>

      {record.problem && <RecordUnavailable problem={record.problem} onRetry={record.reload} />}

      {!record.problem && declined.length === 0 && (
        <section className="panel invite">
          <h2>Nothing has been refused</h2>
          <p>
            {record.loading
              ? "Reading the record."
              : record.events.length === 0
                ? "No decisions recorded yet. Run a query from Explore and come back."
                : `${record.events.length} decision${record.events.length === 1 ? "" : "s"} recorded, all of them answerable.`}
          </p>
          <p className="note">
            An engine that never refuses is either answering easy questions or has a model
            with no grain declared. Ask for revenue broken down by a line-level dimension
            to see one.
          </p>
        </section>
      )}

      {byCode.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Filter by refusal">
          <button type="button" role="tab" aria-selected={code === ""} onClick={() => setCode("")}>
            all {declined.length}
          </button>
          {byCode.map(([c, n]) => (
            <button key={c} type="button" role="tab" aria-selected={code === c} onClick={() => setCode(c)}>
              {c} {n}
            </button>
          ))}
        </div>
      )}

      {shown.map((event, i) => (
        <Refusal key={`${event.time}-${i}`} event={event} />
      ))}
    </div>
  );
}

/**
 * One refusal.
 *
 * Asked on the left, answered on the right. The hint is the product: it is the
 * difference between an engine that blocks you and one that corrects you.
 */
function Refusal({ event }: { event: AuditEvent }) {
  return (
    <section className="panel refusal">
      <header className="refusal-head">
        <code className="refusal-code">{event.code || "refused"}</code>
        <span className={`retry retry-${event.retry || "unknown"}`}>
          {event.retry || "unclassified"}
        </span>
        <span className="grow" />
        <span className="who" title={exactly(event.time)}>
          {event.identity} · {when(event.time)}
        </span>
      </header>

      <div className="refusal-body">
        <div>
          <h3>Asked for</h3>
          <ul className="fields">
            {event.metrics.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
            {event.dimensions.map((d) => (
              <li key={d} className="by">
                by <code>{d}</code>
              </li>
            ))}
          </ul>
          <p className="reason">{event.reason}</p>
        </div>

        <div className="answers">
          <h3>What answers it</h3>
          {event.hint ? (
            <p>{event.hint}</p>
          ) : (
            <p className="note">
              No alternative was offered, which means this question has no correct form
              against the current model.
            </p>
          )}
          <p className="note">{retryMeaning(event.retry)}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Not being served the record is usually a setting rather than a fault, and
 * the two need different reactions from whoever is reading this.
 */
export function RecordUnavailable({
  problem,
  onRetry,
}: {
  problem: { message: string; action: string; notServed: boolean };
  onRetry: () => void;
}) {
  return (
    <section className="panel invite">
      <h2>{problem.notServed ? "The record is not being served" : "The record could not be read"}</h2>
      <p>{problem.message}</p>
      {problem.action && <p className="note">{problem.action}</p>}
      {!problem.notServed && (
        <button className="btn primary" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
