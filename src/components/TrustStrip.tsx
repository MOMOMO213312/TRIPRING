const ITEMS = [
  { icon: RefreshIcon, text: "عروض تُحدَّث كل بضع دقائق" },
  { icon: ShieldIcon, text: "ضمان أفضل سعر" },
  { icon: CheckIcon, text: "شركاء موثوقون" },
  { icon: HeadsetIcon, text: "دعم على مدار الساعة" },
];

export function TrustStrip() {
  return (
    <div className="flex flex-col items-stretch justify-between gap-6 border-y border-gray-200 py-8 sm:flex-row sm:items-center">
      {ITEMS.map((item, i) => (
        <div key={item.text} className="flex flex-1 items-center gap-3 sm:justify-center">
          {i > 0 ? <span className="hidden h-8 w-px bg-gray-200 sm:block" aria-hidden /> : null}
          <item.icon className="size-5 shrink-0 text-[#2563EB]" />
          <span className="text-sm font-medium text-gray-700">{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.3-5M20 15a9 9 0 01-15.3 5" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
