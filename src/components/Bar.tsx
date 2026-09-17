/**
 * The bar carries the two things every page depends on: where you are, and
 * which engine you are talking to as whom.
 *
 * The two rules in the navigation are information rather than decoration.
 * They split it into what the engine is, what it did, and how to use it. The
 * last group works with nothing running at all, which is what you want to
 * know when the engine is the thing that is broken.
 */

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { callerOf, useEngine } from "../lib/engine";

export function Bar() {
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const caller = callerOf(engine.health);
  // Reached is not the same as usable. Health answers without a credential, so
  // an engine that then refuses the model would sit under a green light over
  // an empty page, which is the one thing a status is there to prevent.
  const usable = engine.live && !engine.blocked;

  return (
    <>
      <header className="bar">
        <NavLink to="/explore" className="mark">
          <span className="glyph" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          truegrain
        </NavLink>

        <nav className="sections" aria-label="Sections">
          <NavLink to="/explore" data-offline={String(!usable)}>Explore</NavLink>
          <NavLink to="/model" data-offline={String(!usable)}>Model</NavLink>
          <NavLink to="/governance" data-offline={String(!engine.live)}>Governance</NavLink>
          <span className="rule" aria-hidden="true" />
          {/* The second rule separates what the engine is from what it did.
              Left of the first: the model and what is enforced. Between them:
              the record of decisions. Right of the second: reference, which
              works when the engine is the thing that is broken. */}
          <NavLink to="/refusals" data-offline={String(!usable)}>Refusals</NavLink>
          <NavLink to="/activity" data-offline={String(!usable)}>Activity</NavLink>
          <NavLink to="/spend" data-offline={String(!usable)}>Spend</NavLink>
          <span className="rule" aria-hidden="true" />
          <NavLink to="/connect">Connect</NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>

        <span className="grow" />

        <button
          type="button"
          className={usable ? "status live" : engine.blocked ? "status held" : "status"}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="dot" aria-hidden="true" />
          {usable ? (
            <>
              <code>{short(engine.url)}</code>
              {caller ? <span>as {caller.subject}</span> : <span>not identified</span>}
            </>
          ) : engine.blocked ? (
            <>
              <code>{short(engine.url)}</code>
              <span>needs a token</span>
            </>
          ) : engine.checking ? (
            <span>connecting</span>
          ) : (
            <span>{engine.url ? "cannot reach the engine" : "no engine"}</span>
          )}
        </button>
      </header>

      {open && <ConnectionPanel onDone={() => setOpen(false)} />}
    </>
  );
}

function ConnectionPanel({ onDone }: { onDone: () => void }) {
  const engine = useEngine();
  const [url, setUrl] = useState(engine.url || "http://127.0.0.1:8080");
  const [token, setToken] = useState(engine.token);

  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <section className="panel">
        <h2>Which engine</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            engine.connect(url, token);
            onDone();
          }}
          style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}
        >
          <label>
            <span className="note" style={{ display: "block", margin: "0 0 0.25rem" }}>
              Address
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              autoComplete="off"
            />
          </label>
          <label>
            <span className="note" style={{ display: "block", margin: "0 0 0.25rem" }}>
              Bearer token, if the engine wants one
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn primary" type="submit">
              Connect
            </button>
            <button className="btn" type="button" onClick={onDone}>
              Cancel
            </button>
          </div>
        </form>

        {(engine.problem || engine.blocked) && (
          <p className="note" style={{ color: "var(--grain)" }}>
            {engine.problem || engine.blocked}
          </p>
        )}
        <p className="note">
          The address is remembered. The token is kept for this tab only, so it does not
          outlive the session it was typed into.
        </p>
      </section>
    </div>
  );
}

/** Enough of the URL to tell two engines apart, without the scheme noise. */
function short(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
