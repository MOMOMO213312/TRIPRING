import type { ServicePackageWithServices } from "../lib/api";
import { includedServicesFor, packageBadge, packageLabel, packagePrice } from "../lib/packages";
import type { PackageTier } from "../lib/packages";
import { cn, formatPrice } from "../lib/utils";
import type { AdditionalServiceRow } from "../types/database";

type Props = {
  basePrice: number;
  currency: string;
  packages: ServicePackageWithServices[];
  services: AdditionalServiceRow[];
  selectedPackage: PackageTier | null;
  onSelectPackage: (tier: PackageTier) => void;
  checkedServiceIds: Set<string>;
  onToggleService: (serviceId: string) => void;
};

/** Computes the live total: ticket price + selected package's flat bundle price
 *  + any extra add-on services not already included in that bundle. */
export function selectorTotal(
  basePrice: number,
  selectedPackage: PackageTier | null,
  packages: ServicePackageWithServices[],
  services: AdditionalServiceRow[],
  checkedServiceIds: Set<string>,
): number {
  const pkg = packages.find((p) => p.tier === selectedPackage) ?? packages[0];
  if (!pkg) return basePrice;
  const includedIds = new Set(includedServicesFor(pkg, services).map((s) => s.id));
  const extras = services
    .filter((s) => checkedServiceIds.has(s.id) && !includedIds.has(s.id))
    .reduce((sum, s) => sum + s.price, 0);
  return basePrice + packagePrice(pkg) + extras;
}

export function PackageAndServicesSelector({
  basePrice,
  currency,
  packages,
  services,
  selectedPackage,
  onSelectPackage,
  checkedServiceIds,
  onToggleService,
}: Props) {
  const activePkg = packages.find((p) => p.tier === selectedPackage) ?? packages[0];
  const includedIds = new Set(activePkg ? includedServicesFor(activePkg, services).map((s) => s.id) : []);
  const total = selectorTotal(basePrice, selectedPackage, packages, services, checkedServiceIds);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-3 font-bold text-slate-900">اختر رحلتك</h2>
        <div className="space-y-2.5">
          {packages.map((pkg) => {
            const price = packagePrice(pkg);
            const isActive = pkg.tier === (selectedPackage ?? activePkg?.tier);
            const perks = ["تذكرة الطيران", ...pkg.services.map((s) => s.name)];
            const badge = packageBadge(pkg);
            return (
              <label
                key={pkg.id}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition",
                  isActive ? "border-[#0C7BB3] bg-[#E5F4FB]" : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="package-tier"
                    className="mt-1"
                    checked={isActive}
                    onChange={() => onSelectPackage(pkg.tier)}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{packageLabel(pkg)}</span>
                      {badge ? (
                        <span className="rounded-full bg-[#0C7BB3] px-2 py-0.5 text-[10px] font-bold text-white">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{perks.join(" + ")}</p>
                  </div>
                </div>
                <span className="font-latin shrink-0 font-bold text-slate-900">{formatPrice(price, currency)}</span>
              </label>
            );
          })}
        </div>
      </div>

      {services.length > 0 ? (
        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-3 font-bold text-slate-900">أضف خدماتك</h2>
          <div className="space-y-2">
            {services.map((service) => {
              const included = includedIds.has(service.id);
              const checked = included || checkedServiceIds.has(service.id);
              return (
                <label
                  key={service.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2.5",
                    included ? "bg-slate-50" : "bg-white",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={included}
                      onChange={() => onToggleService(service.id)}
                    />
                    {service.name}
                    {included ? <span className="text-xs font-semibold text-[#16A34A]">مُضمّن ✓</span> : null}
                  </span>
                  <span className="font-latin text-sm text-slate-500">
                    {included ? "—" : `+${formatPrice(service.price, currency)}`}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="font-bold text-slate-900">الإجمالي</span>
        <span className="font-latin text-2xl font-extrabold text-[#0C7BB3]">{formatPrice(total, currency)}</span>
      </div>
    </div>
  );
}
