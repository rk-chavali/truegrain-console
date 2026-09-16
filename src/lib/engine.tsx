/**
 * The connection to one truegrain engine.
 *
 * A self-hosted console cannot assume the engine is on its own origin, so
 * where it lives and who you are talking to it as are real state rather than
 * something implied by the page URL. Both are kept here and surfaced in the
 * bar, because every answer and every refusal the console shows is only
 * interpretable if you know which engine and which identity produced it.
 *
 * The client is the published `truegrain` npm package, the same one any other
 * application would install. Using it here rather than hand-rolling fetch
 * calls means this console exercises the SDK on every page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Client, Unauthorized, type Health } from "truegrain";

const URL_KEY = "truegrain.console.url";
const TOKEN_KEY = "truegrain.console.token";

export interface Connection {
  /** Where the engine is served. */
  url: string;
  /** Bearer token, if the engine wants one. */
  token: string;
  /** A client bound to the current url and token, or null until a url is set. */
  client: Client | null;
  /** The engine's own report, refreshed on connect. */
  health: Health | null;
  /** Why the last connection attempt failed, in the engine's own words. */
  problem: string;
  /**
   * Why the engine answered but will not show this caller the model, empty
   * when it will. Health needs no credential, so an engine can be reachable
   * and still refuse every request that matters.
   */
  blocked: string;
  /** True once health has come back. */
  live: boolean;
  /** True while a connection attempt is in flight. */
  checking: boolean;
  connect(url: string, token: string): void;
  refresh(): void;
}

const EngineContext = createContext<Connection | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  // The URL persists, because reconnecting to the same engine on every visit
  // is the overwhelmingly common case. The token is kept beside it: a console
  // is a tool an operator runs on their own machine, and making them paste a
  // credential on every reload teaches them to keep it somewhere worse.
  const [url, setUrl] = useState(() => localStorage.getItem(URL_KEY) ?? "");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [health, setHealth] = useState<Health | null>(null);
  const [problem, setProblem] = useState("");
  const [blocked, setBlocked] = useState("");
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const client = useMemo(() => {
    if (!url) return null;
    try {
      // fetch is bound explicitly. A browser's fetch throws "Illegal
      // invocation" when called detached from its window, and truegrain 0.1.0
      // stored the bare reference. Fixed in the client for 0.1.1; passing a
      // bound one here works against either and costs nothing.
      const bound = globalThis.fetch.bind(globalThis);
      return new Client(url, token ? { token, fetch: bound } : { fetch: bound });
    } catch {
      return null;
    }
  }, [url, token]);

  useEffect(() => {
    if (!client) {
      setHealth(null);
      setBlocked("");
      return;
    }
    let current = true;
    setChecking(true);
    // Two probes, because they answer two different questions. Health says
    // the engine is there and describes what it enforces, and it answers
    // without a credential. Reading the model is the first request that has
    // to get past authentication, so it is the one that says whether this
    // identity can actually use the engine it just reached.
    client
      .health()
      .then(async (h) => {
        if (!current) return;
        setHealth(h);
        setProblem("");
        try {
          await client.metrics();
          if (current) setBlocked("");
        } catch (err) {
          if (current) setBlocked(unreadable(err, token));
        }
      })
      .catch((err: unknown) => {
        if (!current) return;
        setHealth(null);
        setBlocked("");
        setProblem(describe(err));
      })
      .finally(() => {
        if (current) setChecking(false);
      });
    return () => {
      current = false;
    };
    // token is read inside, but the client is rebuilt whenever it changes, so
    // depending on the client is depending on the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, attempt]);

  const connect = useCallback((nextUrl: string, nextToken: string) => {
    const trimmed = nextUrl.trim().replace(/\/+$/, "");
    setUrl(trimmed);
    setToken(nextToken.trim());
    localStorage.setItem(URL_KEY, trimmed);
    // sessionStorage rather than localStorage for the credential: it should
    // not outlive the tab it was typed into.
    sessionStorage.setItem(TOKEN_KEY, nextToken.trim());
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const value: Connection = {
    url,
    token,
    client,
    health,
    problem,
    blocked,
    live: health !== null,
    checking,
    connect,
    refresh,
  };

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine(): Connection {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error("useEngine must be used inside an EngineProvider");
  return ctx;
}

/**
 * Turn whatever the client threw into one sentence a person can act on.
 *
 * A refusal already says what to do, so its own words are used. Anything else
 * is a deployment problem and says so, because "failed to fetch" tells an
 * operator nothing about whether the engine is down or the URL is wrong.
 */
export function describe(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { reason?: string; message?: string; name?: string };
    if (e.name === "Unauthorized") {
      return "The engine did not accept that token.";
    }
    if (e.reason) return e.reason;
    if (e.message) return e.message;
  }
  return String(err);
}

/**
 * Say why the model could not be read, in terms of what to do next.
 *
 * "Unauthorized" alone is ambiguous: an engine that wants a token you never
 * gave it and an engine that rejected the token you did give it need
 * different actions from you, and only one of them is worth retyping.
 */
function unreadable(err: unknown, token: string): string {
  if (err instanceof Unauthorized) {
    return token
      ? "The engine did not accept that token, so it will not show you the model."
      : "This engine requires a bearer token. Add one and connect again.";
  }
  return describe(err);
}

/** The caller the engine resolved this token to, when it says. */
export function callerOf(health: Health | null): { subject: string; groups?: string[] } | null {
  if (!health) return null;
  const raw = health.raw as { caller?: { subject?: string; groups?: string[] } };
  if (raw.caller?.subject) {
    const out: { subject: string; groups?: string[] } = { subject: raw.caller.subject };
    if (raw.caller.groups) out.groups = raw.caller.groups;
    return out;
  }
  return null;
}
