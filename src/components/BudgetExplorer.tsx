import { useNavigate } from "react-router-dom";

const BUDGETS = [100, 200, 300, 500, 700, 1000];

export function BudgetExplorer() {
  const navigate = useNavigate();

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900">💵 سافر حسب ميزانيتك</h2>
        <p className="text-sm text-slate-600">عندك $300؟ نوريك تقدر تروح فين</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {BUDGETS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => navigate(`/search?budget=${amount}`)}
            className="font-latin flex min-w-[100px] flex-1 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md sm:flex-none"
          >
            <span className="text-xl font-extrabold text-slate-900">${amount}</span>
            <span className="font-sans-ar text-[11px] font-medium text-slate-500">وأقل</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate("/search?budget=1000plus")}
          className="flex min-w-[100px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md sm:flex-none"
        >
          <span className="font-latin text-xl font-extrabold text-slate-900">$1000+</span>
        </button>
      </div>
    </section>
  );
}
