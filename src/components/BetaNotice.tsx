import { useTranslation } from "react-i18next";

// A small, non-dismissible notice shown at the top of the homepage while
// TripRing is testing new flight-data sources (e.g. live search results
// imported from Duffel). Intentionally simple — no state, no dismiss
// logic — since this is meant to stay visible for the whole testing
// period rather than be dismissed once per visitor.

export function BetaNotice() {
  const { t } = useTranslation();
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center justify-center gap-2 text-center">
        <span aria-hidden="true">🧪</span>
        <p className="text-xs sm:text-sm font-medium text-amber-800">
          {t("betaNotice")}
        </p>
      </div>
    </div>
  );
}
