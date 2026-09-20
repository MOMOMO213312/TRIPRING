import { useTranslation } from "react-i18next";

const POINTS = [
  { icon: "🎯", titleKey: "why.beyondPrice", textKey: "why.beyondPriceText" },
  { icon: "📊", titleKey: "why.dealScore", textKey: "why.dealScoreText" },
  { icon: "⚡", titleKey: "why.liveData", textKey: "why.liveDataText" },
] as const;

/** Closing "Why TripRing" section — explains the platform's value prop, not just another flight list. */
export function WhyTripRing() {
  const { t } = useTranslation("home");
  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-2xl sm:text-3xl">{t("why.title")}</h2>
        <p className="mt-2 text-slate-300">{t("why.intro")}</p>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.titleKey} className="rounded-xl bg-white/5 p-5 text-center backdrop-blur-sm">
            <span className="text-3xl" aria-hidden>
              {p.icon}
            </span>
            <h3 className="mt-3 font-bold">{t(p.titleKey)}</h3>
            <p className="mt-1.5 text-sm text-slate-300">{t(p.textKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
