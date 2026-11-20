import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../../design-system/tokens.css";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
