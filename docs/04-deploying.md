# Deploying this console

The console is a static build. `npm run build` produces a `dist/` folder of
files and nothing else: no server, no runtime, no database.

```
npm install
npm run build
```

Serve `dist/` from anything. The router uses hash routing, so deep links work
behind a plain static server with no rewrite rules to configure.

## Where the engine address comes from

The console asks. There is no build-time environment variable pinning it to
one deployment, because the same build should be usable against a local engine
while developing and a shared one afterwards.

The address is remembered in local storage. The token is kept in session
storage, so it does not outlive the tab it was typed into.

## Behind a reverse proxy

The console talks to the engine from the browser, so the engine has to be
reachable from wherever the browser is, not merely from where the console is
served. Two ordinary arrangements:

- Serve both under one origin, the console at `/` and the engine proxied at
  `/v1`. Nothing needs to change here.
- Serve them separately and allow the console's origin on the engine.

## What it is not

There is no charting, no saved queries and no dashboards. This is not a BI
tool, and anything stateful belongs in the model repository under review
rather than in a browser. That is the same argument the engine makes about
model definitions, applied to the tooling around it.
