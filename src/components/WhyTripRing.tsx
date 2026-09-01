const POINTS = [
  {
    icon: "🎯",
    title: "أبعد من السعر",
    text: "نقيّم كل فرصة بقيمتها الحقيقية، لا برخصها وحده.",
  },
  {
    icon: "📊",
    title: "Deal Score لكل عرض",
    text: "تقييم من 100 نقطة يختصر لك القرار في ثوانٍ.",
  },
  {
    icon: "⚡",
    title: "بيانات حيّة",
    text: "أسعار ومقاعد تُحدَّث لحظيًا من شركاء موثوقين.",
  },
];

/** Closing "Why TripRing" section — explains the platform's value prop, not just another flight list. */
export function WhyTripRing() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-2xl sm:text-3xl">لماذا TripRing؟</h2>
        <p className="mt-2 text-slate-300">
          لسنا محرك بحث. نكتشف لك الفرص التي تستحق فعلاً — لا مجرد قائمة رحلات.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-xl bg-white/5 p-5 text-center backdrop-blur-sm">
            <span className="text-3xl" aria-hidden>
              {p.icon}
            </span>
            <h3 className="mt-3 font-bold">{p.title}</h3>
            <p className="mt-1.5 text-sm text-slate-300">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
