const ITEMS = [
  { icon: TagIcon, title: "أفضل سعر مضمون", subtitle: "نطابق أقل سعر" },
  { icon: ShieldIcon, title: "حجز آمن", subtitle: "بياناتك محمية 100%" },
  { icon: HeadsetIcon, title: "دعم على مدار الساعة", subtitle: "هنا لمساعدتك في أي وقت" },
  { icon: CardIcon, title: "دفع سهل", subtitle: "طرق دفع متعددة وآمنة" },
];

export function TrustStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {ITEMS.map((item) => (
        <div
          key={item.title}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFEDE3] text-[#FF7A45]">
            <item.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{item.title}</p>
            <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M3 11.5L11.5 3H19a2 2 0 012 2v7.5l-8.5 8.5a2 2 0 01-2.83 0L3 13.83a2 2 0 010-2.83z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM7 15h4" />
    </svg>
  );
}
