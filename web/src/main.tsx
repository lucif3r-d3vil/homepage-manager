import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./store";
import { registerYaml } from "./monaco/setup";
import "./styles.css";

// Configure Monaco + register YAML highlighting once, before first editor mount.
registerYaml();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
