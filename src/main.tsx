import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

// HashRouter rather than BrowserRouter: this console is self-hosted, and an
// operator dropping a built folder behind any static server should not also
// have to configure a rewrite rule for deep links to work.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
