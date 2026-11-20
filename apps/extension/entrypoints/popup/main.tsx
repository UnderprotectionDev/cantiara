import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import { WebCaptureView } from "../../src/features/capture-triage/ui/views/web-capture-view";

import "./style.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { gcTime: 0, networkMode: "always", retry: false },
    queries: { gcTime: 0, networkMode: "always", retry: false },
  },
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WebCaptureView />
    </QueryClientProvider>
  </React.StrictMode>,
);
