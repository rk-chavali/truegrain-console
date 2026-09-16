import { Navigate, Route, Routes } from "react-router-dom";
import { EngineProvider } from "./lib/engine";
import { Bar } from "./components/Bar";
import { Explore } from "./pages/Explore";
import { Model } from "./pages/Model";
import { Governance } from "./pages/Governance";
import { Connect } from "./pages/Connect";
import { Docs } from "./pages/Docs";

export function App() {
  return (
    <EngineProvider>
      <Bar />
      <Routes>
        <Route path="/" element={<Navigate to="/explore" replace />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/model" element={<Model />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:slug" element={<Docs />} />
        <Route path="*" element={<Navigate to="/explore" replace />} />
      </Routes>
    </EngineProvider>
  );
}
