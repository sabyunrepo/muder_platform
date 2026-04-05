import { initSentry } from "@/lib/sentry";

// Sentry는 가장 먼저 초기화 (에러 캡처 범위 최대화)
initSentry();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setupGlobalErrorHandlers } from "@/lib/global-error-handler";
import "./index.css";

setupGlobalErrorHandlers();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
