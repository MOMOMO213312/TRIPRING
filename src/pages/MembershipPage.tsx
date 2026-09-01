import { MembershipSubscriptionCard } from "../components/customer/MembershipSubscriptionCard";

// Browsing the tiers and prices needs no account — MembershipSubscriptionCard
// only asks the customer to sign in right before the final submit, since
// that's the step that actually writes a row tied to their account.
export function MembershipPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">عضوية TRIPRING</h1>
        <p className="mt-1 text-slate-600">خصومات على الحجوزات، خدمات مجانية، وأولوية في إشعارات الفرص.</p>
      </div>

      <MembershipSubscriptionCard />
    </div>
  );
}
