import * as Sentry from "@sentry/react";

// No-op (silently does nothing) until VITE_SENTRY_DSN is set in the
// deployment environment - safe to ship before the account/DSN exists,
// and safe to leave in local dev without one.
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

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
