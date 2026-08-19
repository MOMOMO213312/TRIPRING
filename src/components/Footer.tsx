import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold text-[#FF6B35]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#FF6B35] text-xs text-white">
              ✈️
            </span>
            TripRing
          </p>
          <p className="mt-2 text-sm text-slate-500">
            منصة اكتشاف فرص سفر — بنساعدك تلاقي مش أرخص تذكرة بس، لكن الفرصة اللي فعلاً تستاهل.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">روابط مهمة</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/faq" className="hover:text-[#FF6B35]">
                الأسئلة الشائعة
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-[#FF6B35]">
                الشروط والأحكام
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-[#FF6B35]">
                سياسة الخصوصية
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">المنصة</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/deals" className="hover:text-[#FF6B35]">
                العروض
              </Link>
            </li>
            <li>
              <Link to="/resale" className="hover:text-[#FF6B35]">
                بيع وشراء التذاكر
              </Link>
            </li>
            <li>
              <Link to="/agency" className="hover:text-[#FF6B35]">
                لوحة الوكالة
              </Link>
            </li>
            <li>
              <Link to="/affiliate" className="hover:text-[#FF6B35]">
                لوحة الأفلييت
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TripRing — سوق فرص السفر
      </div>
    </footer>
  );
}
