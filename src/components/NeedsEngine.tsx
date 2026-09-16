import { Link } from "react-router-dom";
import { useEngine } from "../lib/engine";

/**
 * What a page shows when there is no engine to read.
 *
 * An empty screen is an invitation to act rather than a place to apologise,
 * so this names the one thing missing and where to fix it. It separates the
 * three cases, because each needs a different action: you have not said which
 * engine, the engine you named did not answer, or it answered and will not
 * let this identity read the model.
 */
export function NeedsEngine() {
  const engine = useEngine();

  return (
    <div className="page">
      <section className="panel invite">
        {engine.blocked ? (
          <>
            <h2>The engine will not show you the model</h2>
            <p>{engine.blocked}</p>
            <p>
              Open the connection button in the bar to set a token. The engine takes it
              from <code>-token-env</code> or verifies it against your identity provider,
              so the value is whatever that deployment was started with.
            </p>
            <button className="btn primary" type="button" onClick={engine.refresh}>
              Try again
            </button>
          </>
        ) : engine.url ? (
          <>
            <h2>That engine did not answer</h2>
            <p>{engine.problem || `Nothing responded at ${engine.url}.`}</p>
            <p>
              Check it is running, then try again. Start one with{" "}
              <code>truegrain serve rest -models ./models</code>.
            </p>
            <button className="btn primary" type="button" onClick={engine.refresh}>
              Try again
            </button>
          </>
        ) : (
          <>
            <h2>Point this at an engine</h2>
            <p>
              This console reads a running truegrain engine. Use the connection button in
              the bar to give it an address.
            </p>
            <p>
              Nothing to point it at yet? <Link to="/docs/running">Start one</Link> takes
              about a minute and needs no cloud account.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
