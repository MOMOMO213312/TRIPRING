const ITEMS = [
  { icon: TagIcon, text: "بدون رسوم خفية" },
  { icon: ShieldIcon, text: "حجوزات آمنة" },
  { icon: HeadsetIcon, text: "دعم على مدار الساعة" },
];

export function TrustStrip() {
  return (
    <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-0">
      {ITEMS.map((item, i) => (
        <div key={item.text} className="flex flex-1 items-center gap-3 sm:justify-center">
          {i > 0 ? <span className="hidden h-8 w-px bg-gray-200 sm:block" aria-hidden /> : null}
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#299FD1]">
            <item.icon className="size-4" />
          </span>
          <span className="text-sm font-medium text-gray-700">{item.text}</span>
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
