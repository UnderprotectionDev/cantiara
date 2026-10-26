import React from "react";
import ReactDOM from "react-dom/client";

import { WebCaptureView } from "../../src/features/capture-triage/ui/views/web-capture-view";

import "./style.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <WebCaptureView />
  </React.StrictMode>,
);
