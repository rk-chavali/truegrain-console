# truegrain console

A self-hosted console for [truegrain](https://github.com/rk-chavali/truegrain):
explore the model, read what the deployment does and does not enforce, and copy
the client code for a query you just ran.

```bash
npm install
npm run dev          # http://localhost:5180
```

Point it at a running engine using the connection button in the bar. The engine
has to allow this origin:

```bash
truegrain serve rest -models ./models -db ./demo.duckdb \
  -identity you@example.com -token-env SEMANTIC_TOKEN \
  -cors-origin http://localhost:5180
```

## Five sections, and the rule between them

```
truegrain   Explore  Model  Governance │ Connect  Docs
```

Sections left of the rule read a running engine. Sections right of it work with
nothing running at all, which is what you want to know when the engine is the
thing that is broken.

**Explore** asks questions. Pick metrics and dimensions, add conditions, read
the compiled SQL, run it. When the engine refuses, that refusal gets the most
weight on the screen and the SQL panel says plainly that nothing compiled,
because nothing did.

**Model** is the catalogue as your identity is allowed to see it. Each metric
shows its definition and the dimensions it can legally be grouped by, which are
the two facts that decide whether it answers the question you actually have.

**Governance** separates two things that are easy to confuse: what the engine
decides before it emits SQL, and what the warehouse decides on its own. When
neither is restricting anything, it says so rather than leaving you to infer it.

**Connect** is the install line and working code for each client, filled in with
the engine you are connected to.

**Docs** are markdown files in `docs/`. Editing documentation is editing a file
and opening a pull request, which is the argument the engine makes about models
applied to its own prose.

## The grain stack

Explore draws one plane per level your question touches, at that level's row
density. Ask for a header-grain metric broken down by a line-grain dimension and
the lower plane fills with three times the marks while the engine refuses above
it. The level names and the one that repeats come from the engine's own refusal
rather than from a guess about your model.

## What it is not

No charts, no saved queries, no dashboards. This is not a BI tool, and anything
stateful belongs in the model repository under review rather than in a browser.

## Deploying it

`npm run build` produces a `dist/` folder and nothing else: no server, no
runtime, no database. Serve it from anything. Routing is hash-based, so deep
links work behind a plain static server with no rewrite rules.

The engine address is asked for rather than baked in at build time, so one
build serves a local engine while developing and a shared one afterwards. The
address is remembered; the token is kept for the tab only.

## Licence

Apache 2.0, matching the engine.
