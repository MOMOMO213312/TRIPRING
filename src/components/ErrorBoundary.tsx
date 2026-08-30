import { Component, type ErrorInfo, type ReactNode } from "react";

import { Sentry } from "../lib/sentry";

/**
 * Catches render-time exceptions anywhere below it in the tree and shows a
 * recoverable Arabic error screen instead of an unhandled white screen.
 * Wraps <Routes> in App.tsx so a bug on any single page never takes down
 * the whole app for a visitor who's often already anxious about booking
 * (see audit: "any exception during render crashes the whole page with a
 * white screen and no message — high priority to fix").
 */
type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught render error:", error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  private reset = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <span className="text-4xl" aria-hidden>
            😕
          </span>
          <h1 className="text-xl font-bold text-slate-900">حصل خطأ غير متوقع</h1>
          <p className="max-w-sm text-sm text-slate-600">
            في مشكلة مؤقتة في عرض هذه الصفحة. جرّب العودة للصفحة الرئيسية، ولو المشكلة استمرت تواصل معنا.
          </p>
          <button type="button" onClick={this.reset} className="cta-primary px-5 py-2.5 text-sm">
            العودة للصفحة الرئيسية
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
