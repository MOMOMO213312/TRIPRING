import { classifyService, includedServicesFor, packagePrice, usePackageOptions } from "../lib/packages";
import type { PackageOption, PackageTier } from "../lib/packages";
import { cn, formatPrice } from "../lib/utils";
import type { AdditionalServiceRow } from "../types/database";

type Props = {
  basePrice: number;
  currency: string;
  services: AdditionalServiceRow[];
  selectedPackage: PackageTier;
  onSelectPackage: (tier: PackageTier) => void;
  checkedServiceIds: Set<string>;
  onToggleService: (serviceId: string) => void;
};

/** Computes the live total: selected package price + any extra add-on services not already bundled in it. */
export function selectorTotal(
  basePrice: number,
  selectedPackage: PackageTier,
  services: AdditionalServiceRow[],
  checkedServiceIds: Set<string>,
  packageOptions: PackageOption[],
): number {
  const pkg = packageOptions.find((p) => p.id === selectedPackage) ?? packageOptions[0];
  const includedIds = new Set(includedServicesFor(pkg, services).map((s) => s.id));
  const extras = services
    .filter((s) => checkedServiceIds.has(s.id) && !includedIds.has(s.id))
    .reduce((sum, s) => sum + s.price, 0);
  return packagePrice(basePrice, pkg) + extras;
}

export function PackageAndServicesSelector({
  basePrice,
  currency,
  services,
  selectedPackage,
  onSelectPackage,
  checkedServiceIds,
  onToggleService,
}: Props) {
  const packageOptions = usePackageOptions();
  const activePkg = packageOptions.find((p) => p.id === selectedPackage) ?? packageOptions[0];
  const includedIds = new Set(includedServicesFor(activePkg, services).map((s) => s.id));
  const total = selectorTotal(basePrice, selectedPackage, services, checkedServiceIds, packageOptions);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-3 font-bold text-slate-900">اختر رحلتك</h2>
        <div className="space-y-2.5">
          {packageOptions.map((pkg) => {
            const price = packagePrice(basePrice, pkg);
            const isActive = pkg.id === selectedPackage;
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
                    onChange={() => onSelectPackage(pkg.id)}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{pkg.label}</span>
                      {pkg.badge ? (
                        <span className="rounded-full bg-[#0C7BB3] px-2 py-0.5 text-[10px] font-bold text-white">
                          {pkg.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{pkg.perks.join(" + ")}</p>
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
              const key = classifyService(service);
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
                    {service.type}
                    {included ? <span className="text-xs font-semibold text-[#16A34A]">مُضمّن ✓</span> : null}
                  </span>
                  <span className="font-latin text-sm text-slate-500">
                    {included ? "—" : `+${formatPrice(service.price, currency)}`}
                  </span>
                  {/* key kept for potential future icon-per-category use */}
                  {key ? null : null}
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
