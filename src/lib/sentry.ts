import * as Sentry from "@sentry/react";

// The DSN is not a secret (it's designed to ship inside the public JS
// bundle - see https://docs.sentry.io/product/sentry-basics/dsn-explainer/),
// same reasoning as the VITE_BANK_* fallback defaults in payment-config.ts.
// VITE_SENTRY_DSN can still override this per-environment if ever needed.
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
  "https://7605994d55f416babd09531809306fd8@o4512002281046016.ingest.de.sentry.io/4512002304245840";

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    // Session Replay / tracing are separate Sentry quotas from error
    // events - keep both low so a busy day of real users doesn't burn
    // through the free tier just from sampling.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [Sentry.replayIntegration()],
  });
}

export { Sentry };
