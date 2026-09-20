import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import App from "./App";
import "./i18n";
import { initSentry } from "./lib/sentry";
import "./index.css";

initSentry();

/**
 * Re-mount the tree when the UI language changes so that every string, date and number
 * (including those produced by plain helper functions, not just `useTranslation` consumers)
 * is re-rendered in the new language.
 */
function Root() {
  const { i18n } = useTranslation();
  return <App key={i18n.resolvedLanguage} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
