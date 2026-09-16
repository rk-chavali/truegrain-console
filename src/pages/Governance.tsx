/**
 * Governance: what this deployment enforces, and what it does not.
 *
 * The honest reporting is the product here. Overstating a guarantee is worse
 * than not offering one, so the gaps get the same weight as the controls and
 * the page never renders an absent control as though it were present.
 */

import { callerOf, useEngine } from "../lib/engine";
import { NeedsEngine } from "../components/NeedsEngine";

export function Governance() {
  const engine = useEngine();
  if (!engine.live || !engine.health) return <NeedsEngine />;

  const h = engine.health;
  const caller = callerOf(h);
  const engineEnforces = h.governance.columnLevel;
  const warehouseEnforces = h.dialect.columnLevelSecurity || h.dialect.rowLevelSecurity;

  return (
    <div className="page">
      <h1>Governance</h1>
      <p className="lede">
        Two different questions, and they are not the same. What this engine decides before
        it emits SQL, and what the warehouse decides on its own. A caller holding warehouse
        credentials is subject only to the second.
      </p>

      <section className="panel">
        <h2>Who you are</h2>
        {caller ? (
          <p style={{ margin: 0 }}>
            The engine resolved your token to{" "}
            <code style={{ fontFamily: "var(--mono)", color: "var(--flow)" }}>{caller.subject}</code>
            {caller.groups?.length ? ` in ${caller.groups.join(", ")}` : ""}. Every decision on
            this page is about that identity, and the audit log records it on every query.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--grain)" }}>
            No identity. This engine is not asking you for a credential, so it cannot tell you
            apart from anyone else who can reach it and its audit log cannot either.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>What the engine enforces</h2>
        <div className="claims">
          <Claim
            on={engineEnforces}
            title={`Column access: ${h.governance.resolver}`}
            detail={h.governance.note}
          />
        </div>
      </section>

      <section className="panel">
        <h2>What the warehouse enforces by itself</h2>
        <div className="claims">
          <Claim
            on={h.dialect.columnLevelSecurity}
            title="Column-level security"
            detail={
              h.dialect.columnLevelSecurity
                ? `${h.dialect.dialect} restricts columns independently of this engine.`
                : `${h.dialect.dialect} is not restricting columns, so a caller with direct credentials reads every column.`
            }
          />
          <Claim
            on={h.dialect.rowLevelSecurity}
            title="Row-level security"
            detail={
              h.dialect.rowLevelSecurity
                ? `${h.dialect.dialect} filters rows independently of this engine.`
                : `${h.dialect.dialect} is not filtering rows, so no rows are withheld beyond the conditions in a request.`
            }
          />
        </div>
        {h.dialect.note && <p className="note">{h.dialect.note}</p>}
      </section>

      {h.enforcementNotes.length > 0 && (
        <section className="panel">
          <h2>Read these before trusting it with anything sensitive</h2>
          <div className="claims">
            {h.enforcementNotes.map((note) => (
              <Claim key={note} on={false} title={note} detail="" />
            ))}
          </div>
        </section>
      )}

      {!engineEnforces && !warehouseEnforces && (
        <section className="panel refusal">
          <h3 className="verdict">Nothing is restricted here</h3>
          <p className="reason">
            Neither the engine nor the warehouse is withholding anything, so every caller who
            can reach this deployment can read every column of every model it serves. That is
            a reasonable configuration for local work against fixture data and the wrong one
            for anything else.
          </p>
          <div className="todo">
            <h4>What to do</h4>
            <p>
              Point the engine at a policy source: <code>-policy</code> for a file, or{" "}
              <code>-policy-tags</code> to resolve access from the BigQuery policy tags already
              on your columns.
            </p>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Executor</h2>
        <p style={{ margin: 0, color: "var(--text-dim)" }}>{h.executor}</p>
      </section>

      <section className="panel">
        <h2>Which definitions</h2>
        <p style={{ margin: 0, color: "var(--text-dim)" }}>
          Workspace <code style={{ fontFamily: "var(--mono)" }}>{h.workspace}</code> at{" "}
          <code style={{ fontFamily: "var(--mono)", color: "var(--flow)" }}>{h.workspaceDigest}</code>.
          Two results carrying that digest were produced by exactly the same definitions, which
          is how a disagreement about a number gets settled.
        </p>
      </section>
    </div>
  );
}

function Claim({ on, title, detail }: { on: boolean; title: string; detail: string }) {
  return (
    <div className={on ? "claim on" : "claim off"}>
      <span className="flag" aria-hidden="true" />
      <span>
        <b>{title}</b>
        {detail && <span>{detail}</span>}
      </span>
    </div>
  );
}
