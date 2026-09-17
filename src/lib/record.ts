/**
 * The recorded decisions, fetched once and shared by the three screens that
 * read them.
 *
 * Refusals, activity and spend are three questions asked of one record, not
 * three endpoints. Fetching separately would mean three requests for the same
 * window and three chances for them to disagree about what just happened,
 * which is exactly the confusion an operator opens these screens to resolve.
 */

import { useCallback, useEffect, useState } from "react";
import type { AuditEvent } from "truegrain";
import { useEngine } from "./engine";

/** Why the record could not be read, in terms of what to do about it. */
export interface RecordProblem {
  /** What an operator should be told. */
  message: string;
  /** What they should do next, when there is something. */
  action: string;
  /**
   * True when the engine works fine and simply does not serve this. That is a
   * configuration choice rather than a fault, and a screen that renders it as
   * a fault sends somebody looking for a broken engine.
   */
  notServed: boolean;
}

export interface RecordState {
  events: AuditEvent[];
  loading: boolean;
  problem: RecordProblem | null;
  reload(): void;
}

/** How many decisions to ask for. The engine caps this at 200. */
const WINDOW = 200;

export function useRecord(): RecordState {
  const engine = useEngine();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<RecordProblem | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const client = engine.client;
    if (!client || !engine.live) return;

    let current = true;
    setLoading(true);
    client
      .audit({ limit: WINDOW })
      .then((page) => {
        if (!current) return;
        setEvents(page.events);
        setProblem(null);
      })
      .catch((err: unknown) => {
        if (!current) return;
        setEvents([]);
        setProblem(describeRecordFailure(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [engine.client, engine.live, attempt]);

  return { events, loading, problem, reload };
}

/**
 * Turn a failure into something an operator can act on.
 *
 * Two of these mean the engine is working exactly as configured, and saying
 * "could not load" for either would send somebody debugging a healthy engine.
 */
export function describeRecordFailure(err: unknown): RecordProblem {
  const e = err as { code?: string; reason?: string; message?: string } | null;

  if (e?.code === "audit_not_served") {
    return {
      notServed: true,
      message: "This engine keeps the record but does not serve it.",
      action:
        "Restart it with -audit-readers naming who may read it. It is off by " +
        "default because the record contains every caller's activity.",
    };
  }
  if (e?.code === "not_an_audit_reader") {
    return {
      notServed: true,
      message: "The engine does not recognise you as someone who may read the record.",
      action: "Ask an operator to add this identity to -audit-readers.",
    };
  }
  return {
    notServed: false,
    message: e?.reason || e?.message || String(err),
    action: "",
  };
}

/** Decisions worth separating on a screen. */
export const REFUSED = "refused";
export const DENIED = "denied";

/**
 * A refusal, which is not an error.
 *
 * The engine found a question it could not answer accurately and said so. A
 * denial is a different thing and is counted separately: that is access, this
 * is correctness.
 */
export function refusals(events: AuditEvent[]): AuditEvent[] {
  return events.filter((e) => e.decision === REFUSED);
}

/** What a retry classification means for the person reading it. */
export function retryMeaning(retry: string): string {
  switch (retry) {
    case "modify":
      return "answerable, but not as written";
    case "later":
      return "nothing is wrong with the request";
    case "never":
      return "asking again will not help";
    default:
      return "unclassified";
  }
}

/** Bytes, at a size a person reads. */
export function bytes(n: number): string {
  if (n <= 0) return "not reported";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** A time a person can place, without a library. */
export function when(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;

  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The exact time, for a tooltip, since "3h ago" is not evidence. */
export function exactly(iso: string): string {
  const then = new Date(iso);
  return Number.isNaN(then.getTime()) ? iso : then.toLocaleString();
}

/**
 * Why a query that ran can report no cost.
 *
 * Three different reasons, and an operator reading a zero needs to know which
 * one they are looking at. A warehouse that bills nobody, a warehouse that
 * billed nothing because it answered from cache, and a warehouse that billed
 * something this engine could not read all render as the same zero.
 */
export function noCostReason(dialect: string): string {
  if (dialect === "duckdb" || dialect === "postgres") {
    return "This warehouse bills nobody and reports nothing, so every query here reads as no cost.";
  }
  if (dialect === "bigquery") {
    return (
      "BigQuery answers a repeated query from cache and charges nothing for it, " +
      "so a query that ran a second time genuinely costs nothing."
    );
  }
  return "This warehouse reported no cost, which is not the same as the query being free.";
}
