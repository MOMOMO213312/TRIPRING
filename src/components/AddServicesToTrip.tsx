import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { addServicesToBooking, fetchBookableAddOns } from "../lib/api";
import { friendlyErrorMessage } from "../lib/errors";
import { serviceDisplayLabel, serviceRawName } from "../lib/servicePackages";
import { formatPrice } from "../lib/utils";
import type { AdditionalServiceRow } from "../types/database";
import { Button } from "./ui/Button";

type Leg = "departure" | "arrival";

/**
 * Post-booking "add services" panel for My Trips. The server (RPC
 * add_services_to_booking_by_contact) is the authority on price, eligibility
 * (not cancelled, flight not departed, no duplicates) and routing — this
 * component only collects service_id / quantity / airport leg.
 */
export function AddServicesToTrip({
  bookingNumber,
  contact,
  currency,
  bookingStatus,
  existingServiceNames,
  onAdded,
}: {
  bookingNumber: string;
  contact: string;
  currency: string;
  bookingStatus: string;
  existingServiceNames: string[];
  onAdded: () => void;
}) {
  const { t } = useTranslation("booking");
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<AdditionalServiceRow[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [legs, setLegs] = useState<Record<string, Leg>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAmount, setDoneAmount] = useState<number | null>(null);

  useEffect(() => {
    if (open && catalog === null) {
      fetchBookableAddOns().then(setCatalog);
    }
  }, [open, catalog]);

  const available = useMemo(() => {
    const taken = new Set(existingServiceNames.map((n) => n.trim()));
    return (catalog ?? []).filter((s) => !taken.has(serviceRawName(s).trim()));
  }, [catalog, existingServiceNames]);

  const isGround = (s: AdditionalServiceRow) => s.fulfillment_type === "ground_handling";
  const selected = available.filter((s) => checked.has(s.id));
  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const missingLeg = selected.some((s) => isGround(s) && !legs[s.id]);
  const alreadyPaid = bookingStatus === "paid" || bookingStatus === "ticket_issued";

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await addServicesToBooking(
        bookingNumber,
        contact,
        selected.map((s) => ({
          service_id: s.id,
          quantity: 1,
          airport_leg: isGround(s) ? legs[s.id] : null,
        })),
      );
      setDoneAmount(result.added_amount);
      setChecked(new Set());
      onAdded();
    } catch (err) {
      setError(friendlyErrorMessage(err, "booking:addServices.failed", "AddServicesToTrip.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4 border-t border-slate-100 pt-4">
        {doneAmount !== null ? (
          <p className="mb-2 text-sm font-semibold text-green-700">
            {t("addServices.added", { amount: formatPrice(doneAmount, currency) })}
            {alreadyPaid ? t("addServices.addedPaidSuffix") : ""}
          </p>
        ) : null}
        <Button type="button" variant="outline" fullWidth onClick={() => setOpen(true)}>
          {t("addServices.open")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{t("addServices.heading")}</p>
        <button type="button" className="text-xs text-slate-400" onClick={() => setOpen(false)}>
          {t("addServices.close")}
        </button>
      </div>

      {catalog === null ? <p className="text-sm text-slate-500">{t("addServices.loading")}</p> : null}
      {catalog !== null && available.length === 0 ? (
        <p className="text-sm text-slate-500">{t("addServices.none")}</p>
      ) : null}

      <div className="space-y-2">
        {available.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-100 p-2.5">
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggle(s.id)} />
                {serviceDisplayLabel(s)}
              </span>
              <span className="font-latin text-sm text-slate-500">+{formatPrice(s.price, currency)}</span>
            </label>
            {isGround(s) && checked.has(s.id) ? (
              <select
                className="mt-2 w-full rounded-md border border-slate-200 p-1.5 text-sm"
                value={legs[s.id] ?? ""}
                onChange={(e) => setLegs((prev) => ({ ...prev, [s.id]: e.target.value as Leg }))}
              >
                <option value="">{t("addServices.chooseAirport")}</option>
                <option value="departure">{t("addServices.departureAirport")}</option>
                <option value="arrival">{t("addServices.arrivalAirport")}</option>
              </select>
            ) : null}
          </div>
        ))}
      </div>

      {alreadyPaid && selected.length > 0 ? (
        <p className="text-xs text-slate-500">{t("addServices.paidNote")}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="button" fullWidth disabled={submitting || selected.length === 0 || missingLeg} onClick={submit}>
        {submitting
          ? t("addServices.adding")
          : selected.length > 0
            ? t("addServices.confirm", { amount: formatPrice(total, currency) })
            : t("addServices.chooseService")}
      </Button>
    </div>
  );
}
