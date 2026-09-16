# Running an engine

This console reads a truegrain engine over HTTP. It does not embed one, so
something has to be serving before Explore, Model and Governance have anything
to show.

## Locally, in about a minute

No cloud account and no credentials. DuckDB is a single executable.

```
truegrain serve rest \
  -models ./models \
  -db ./demo.duckdb \
  -identity you@example.com \
  -token-env SEMANTIC_TOKEN
```

Then open the connection button in the bar and give it `http://127.0.0.1:8080`
and whatever `SEMANTIC_TOKEN` holds.

`-identity` is required alongside `-token-env`. A static token is an identity
claim: it says "I am X". Without X every audited decision records an empty
subject, which cannot answer the one question an audit log exists to answer.

## Against BigQuery

```
truegrain serve rest \
  -models ./models \
  -dialect bigquery -project my-project -location US \
  -policy-tags -impersonate \
  -oidc-issuer https://accounts.google.com -oidc-audience truegrain
```

Credentials are Application Default Credentials and nothing else. No
configuration field takes a key path, because a key path in a project file
becomes a key file in a git repository.

Two behaviours are worth knowing before the first invoice. Every query is
estimated with a dry run before it is executed, and anything over the scan cap
is refused rather than run. `-impersonate` issues each query as the calling
service account, which is what makes the warehouse's own row and column
security apply to the caller rather than to the engine's own identity.

## What the console needs from it

The console is an ordinary API client. It calls the same endpoints any other
client calls, with the token you gave it, and can see nothing a `curl` command
could not. If a page shows you less than you expected, the engine is refusing
it for your identity rather than the console hiding it.
