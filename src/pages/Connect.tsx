/**
 * Connect: wiring your own code to this engine.
 *
 * Everything here is filled in with the address you are actually connected
 * to, so it is a snippet to paste rather than a template to adapt. This page
 * works with no engine running, because deciding whether to install a client
 * is something people do before they have one.
 */

import { useState } from "react";
import { useEngine } from "../lib/engine";

type Lang = "python" | "typescript" | "go" | "curl";

export function Connect() {
  const engine = useEngine();
  const [lang, setLang] = useState<Lang>("python");
  const url = engine.url || "http://127.0.0.1:8080";

  return (
    <div className="page">
      <h1>Connect</h1>
      <p className="lede">
        Three clients and an MCP server, all speaking to the same engine. None of them can
        send SQL, because there is no endpoint that accepts it.
      </p>

      <section className="panel">
        <h2>Install a client</h2>
        <div className="tabs" role="tablist">
          {(["python", "typescript", "go", "curl"] as Lang[]).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={l === lang} onClick={() => setLang(l)}>
              {l}
            </button>
          ))}
        </div>
        <pre className="code">{INSTALL[lang]}</pre>
        <h3 style={{ marginTop: "1.2rem" }}>Then ask it something</h3>
        <pre className="code">{usage(lang, url)}</pre>
        <p className="note">
          Set <code>SEMANTIC_URL</code> to <code>{url}</code> and <code>SEMANTIC_TOKEN</code> to
          your token. Keeping the token in the environment keeps it out of source and out of
          the process list, which is where a token passed as a flag ends up.
        </p>
      </section>

      <section className="panel">
        <h2>Connect an agent over MCP</h2>
        <p style={{ color: "var(--text-dim)" }}>
          The engine speaks the Model Context Protocol with four tools: list_metrics,
          describe_metric, list_dimensions and query. There is no fifth, and adding one that
          accepts SQL fails the engine's own test suite.
        </p>
        <pre className="code">{MCP}</pre>
      </section>

      <section className="panel">
        <h2>Read a refusal</h2>
        <p style={{ color: "var(--text-dim)" }}>
          The engine declines questions it cannot answer correctly rather than returning a
          plausible wrong number. Every client carries the same three branches, and choosing
          between them is the difference between an agent that corrects itself and one that
          loops.
        </p>
        <pre className="code">{REFUSAL[lang === "curl" ? "python" : lang]}</pre>
      </section>
    </div>
  );
}

const INSTALL: Record<Lang, string> = {
  python: "pip install truegrain",
  typescript: "npm install truegrain",
  go: "go get github.com/rk-chavali/truegrain-go",
  curl: "# nothing to install",
};

function usage(lang: Lang, url: string): string {
  if (lang === "curl") {
    return [
      `curl ${url}/v1/query \\`,
      `  -H 'Authorization: Bearer $SEMANTIC_TOKEN' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '{"metrics":["sales.order_revenue"],"dimensions":["sales.customers.region"]}'`,
    ].join("\n");
  }
  if (lang === "python") {
    return [
      "from truegrain import Client",
      "",
      "client = Client.from_env()          # SEMANTIC_URL, SEMANTIC_TOKEN",
      "result = client.run(",
      '    metrics=["sales.order_revenue"],',
      '    dimensions=["sales.customers.region"],',
      ")",
      "print(result.to_dataframe())        # compiled_sql and model_version ride in df.attrs",
    ].join("\n");
  }
  if (lang === "typescript") {
    return [
      'import { Client } from "truegrain";',
      "",
      "const client = Client.fromEnv();",
      "const result = await client.run({",
      '  metrics: ["sales.order_revenue"],',
      '  dimensions: ["sales.customers.region"],',
      "});",
      "console.table(result.toObjects());",
    ].join("\n");
  }
  return [
    "client, err := truegrain.FromEnv()",
    "",
    "result, err := client.Run(ctx, truegrain.Request{",
    '\tMetrics:    []string{"sales.order_revenue"},',
    '\tDimensions: []string{"sales.customers.region"},',
    "})",
  ].join("\n");
}

const MCP = [
  "claude mcp add truegrain -- \\",
  "  truegrain serve mcp -models /path/to/models -db /path/to/demo.duckdb",
].join("\n");

const REFUSAL: Record<"python" | "typescript" | "go", string> = {
  python: [
    "from truegrain import Refused",
    "",
    "try:",
    "    result = client.run(metrics=[...], dimensions=[...])",
    "except Refused as refusal:",
    "    if refusal.should_modify():",
    "        ...  # answerable, but not as written; refusal.hint names what does answer it",
    "    elif refusal.should_wait():",
    "        ...  # nothing is wrong with the request; the same call may work shortly",
    "    elif refusal.is_final():",
    "        ...  # a denial; say so rather than substituting a different metric",
  ].join("\n"),
  typescript: [
    'import { Refused } from "truegrain";',
    "",
    "try {",
    "  const result = await client.run({ metrics: [...] });",
    "} catch (error) {",
    "  if (error instanceof Refused) {",
    "    if (error.shouldModify) { /* fix the request; error.hint says how */ }",
    "    else if (error.shouldWait) { /* try the same thing shortly */ }",
    "    else if (error.isFinal) { /* a denial; stop and say why */ }",
    "  }",
    "}",
  ].join("\n"),
  go: [
    "result, err := client.Run(ctx, req)",
    "",
    "var refusal *truegrain.Refused",
    "if errors.As(err, &refusal) {",
    "\tswitch {",
    "\tcase refusal.ShouldModify():  // answerable, but not as written",
    "\tcase refusal.ShouldWait():    // nothing wrong with the request",
    "\tcase refusal.IsFinal():       // a denial; stop and say why",
    "\t}",
    "}",
  ].join("\n"),
};
