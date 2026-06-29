import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Normalize accidental double slashes in externally-shared links (e.g. email URLs like //respond-invitation)
// so React Router can match the intended route.
(() => {
  const { pathname, search, hash } = window.location;
  const normalizedPathname = pathname.replace(/\/{2,}/g, "/");
  if (normalizedPathname !== pathname) {
    window.history.replaceState(null, "", `${normalizedPathname}${search}${hash}`);
  }
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
