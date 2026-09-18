import { describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "truegrain";
import {
  bytes,
  DENIED,
  describeRecordFailure,
  exactly,
  noCostReason,
  refusals,
  REFUSED,
  retryMeaning,
  when,
} from "./record";

/**
 * The Refusals, Activity and Spend screens are three readings of one record,
 * and every judgement they make about it happens in these functions.
 *
 * The one worth guarding hardest is describeRecordFailure. Two of its cases
 * are an engine working exactly as configured, and rendering either as a fault
 * sends an operator debugging something that is not broken.
 */

const event = (over: Partial<AuditEvent> = {}): AuditEvent =>
  ({ decision: "allowed", ...over }) as AuditEvent;

describe("reading a failure", () => {
  it("says an engine that does not serve the record is not broken", () => {
    const problem = describeRecordFailure({ code: "audit_not_served" });

    expect(problem.notServed).toBe(true);
    expect(problem.action).toMatch(/-audit-readers/);
  });

  it("says an unauthorised reader is not broken either", () => {
    const problem = describeRecordFailure({ code: "not_an_audit_reader" });

    expect(problem.notServed).toBe(true);
    expect(problem.action).toMatch(/operator/);
  });

  it("treats anything else as a fault worth showing", () => {
    const problem = describeRecordFailure({ code: "boom", reason: "the engine fell over" });

    expect(problem.notServed).toBe(false);
    expect(problem.message).toBe("the engine fell over");
  });

  it("still says something when the failure is not an object", () => {
    // A network failure arrives as a TypeError, not a refusal, and an empty
    // message would render as a blank screen with no explanation at all.
    expect(describeRecordFailure(new Error("Failed to fetch")).message).toBe("Failed to fetch");
    expect(describeRecordFailure("offline").message).toBe("offline");
    expect(describeRecordFailure(null).message).not.toBe("");
  });
});

describe("separating refusals from denials", () => {
  it("counts a refusal and leaves a denial alone", () => {
    // Access and correctness are different questions. Folding denials into
    // the refusal count would make the engine look like it cannot answer
    // questions it simply would not answer for that caller.
    const events = [
      event({ decision: REFUSED }),
      event({ decision: DENIED }),
      event({ decision: "allowed" }),
      event({ decision: REFUSED }),
    ];

    expect(refusals(events)).toHaveLength(2);
    expect(refusals(events).every((e) => e.decision === REFUSED)).toBe(true);
  });

  it("returns nothing from an empty record rather than failing", () => {
    expect(refusals([])).toEqual([]);
  });
});

describe("what a retry classification means", () => {
  it("translates each class into what the reader should do", () => {
    expect(retryMeaning("modify")).toMatch(/not as written/);
    expect(retryMeaning("later")).toMatch(/nothing is wrong/);
    expect(retryMeaning("never")).toMatch(/will not help/);
  });

  it("admits it does not recognise a class rather than guessing", () => {
    // A class this console has not been taught must not be rendered as one it
    // has. "unclassified" is honest; silently showing "never" is not.
    expect(retryMeaning("something_new")).toBe("unclassified");
    expect(retryMeaning("")).toBe("unclassified");
  });
});

describe("bytes", () => {
  it("scales to a unit a person reads", () => {
    expect(bytes(512)).toBe("512 B");
    expect(bytes(1024)).toBe("1.0 KiB");
    expect(bytes(1536)).toBe("1.5 KiB");
    expect(bytes(1024 ** 3)).toBe("1.0 GiB");
  });

  it("drops the decimal once the number is large enough not to need it", () => {
    expect(bytes(1024 * 20)).toBe("20 KiB");
  });

  it("does not claim zero bytes were scanned", () => {
    // Zero here means the warehouse reported nothing, which is not the same
    // as a query that scanned nothing, and the Spend screen explains which.
    expect(bytes(0)).toBe("not reported");
    expect(bytes(-1)).toBe("not reported");
  });

  it("stops at the largest unit it knows", () => {
    expect(bytes(1024 ** 6)).toMatch(/TiB$/);
  });
});

describe("times", () => {
  it("reads recent moments in relative terms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));

    expect(when("2026-09-18T11:59:30Z")).toBe("just now");
    expect(when("2026-09-18T11:30:00Z")).toBe("30m ago");
    expect(when("2026-09-18T09:00:00Z")).toBe("3h ago");

    vi.useRealTimers();
  });

  it("gives back an unparseable timestamp rather than showing NaN", () => {
    expect(when("not a date")).toBe("not a date");
    expect(exactly("not a date")).toBe("not a date");
    expect(when("")).toBe("");
  });
});

describe("why a query reports no cost", () => {
  it("gives a different reason per warehouse, because a zero means three things", () => {
    const duckdb = noCostReason("duckdb");
    const bigquery = noCostReason("bigquery");
    const unknown = noCostReason("snowflake");

    expect(duckdb).not.toBe(bigquery);
    expect(bigquery).toMatch(/cache/);
    expect(unknown).toMatch(/not the same as the query being free/);
  });
});
