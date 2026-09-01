import { AuthGate } from "../components/AuthGate";
import { MembershipSubscriptionCard } from "../components/customer/MembershipSubscriptionCard";

export function MembershipPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">عضوية TRIPRING</h1>
        <p className="mt-1 text-slate-600">خصومات على الحجوزات، خدمات مجانية، وأولوية في إشعارات الفرص.</p>
      </div>

      <AuthGate title="سجّل الدخول عشان تشترك في عضوية TRIPRING">{() => <MembershipSubscriptionCard />}</AuthGate>
    </div>
  );
}
