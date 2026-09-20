import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import i18n from "../i18n";
import type { PaymentMethod } from "../types/database";

/**
 * ⚠️ LAUNCH BLOCKER — replace the placeholder values below with TripRing's real
 * payment details before going live. They were previously hardcoded directly
 * inside BookingPage.tsx (and duplicated nowhere else); they now live in ONE
 * place so there is a single spot to edit.
 *
 * Prefer setting these via environment variables (.env / hosting provider)
 * so real account details never need to be committed to the repo:
 *   VITE_BANK_NAME, VITE_BANK_IBAN, VITE_BANK_ACCOUNT_NAME,
 *   VITE_INSTAPAY_HANDLE, VITE_VODAFONE_CASH_NUMBER
 */
const BANK_NAME = import.meta.env.VITE_BANK_NAME || "CIB";
const BANK_IBAN = import.meta.env.VITE_BANK_IBAN || "EG000000000000000000000000";
const BANK_ACCOUNT_NAME = import.meta.env.VITE_BANK_ACCOUNT_NAME || "TripRing Travel";
const INSTAPAY_HANDLE = import.meta.env.VITE_INSTAPAY_HANDLE || "tripring@instapay";
const VODAFONE_CASH_NUMBER = import.meta.env.VITE_VODAFONE_CASH_NUMBER || "01000000000";

// True while any value above is still the placeholder default — used to warn
// staff (e.g. in the agency dashboard) that real payment details are missing.
export const PAYMENT_DETAILS_ARE_PLACEHOLDER =
  BANK_IBAN === "EG000000000000000000000000" ||
  INSTAPAY_HANDLE === "tripring@instapay" ||
  VODAFONE_CASH_NUMBER === "01000000000";

export type PaymentMethodOption = { value: PaymentMethod; label: string; details: string };

const PAYMENT_METHOD_VALUES: PaymentMethod[] = ["bank_transfer", "instapay", "vodafone_cash"];

const DETAIL_PARAMS: Record<PaymentMethod, Record<string, string>> = {
  bank_transfer: { bank: BANK_NAME, iban: BANK_IBAN, account: BANK_ACCOUNT_NAME },
  instapay: { handle: INSTAPAY_HANDLE },
  vodafone_cash: { number: VODAFONE_CASH_NUMBER },
};

/** Translated payment methods (label + where-to-send details) in the active UI language. */
export function usePaymentMethods(): PaymentMethodOption[] {
  const { t, i18n } = useTranslation("common");
  return useMemo(
    () =>
      PAYMENT_METHOD_VALUES.map((value) => ({
        value,
        label: t(`payment.${value}.label`),
        details: t(`payment.${value}.details`, DETAIL_PARAMS[value]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
}

/** Label for a stored payment_method value (falls back to the raw value for unknown methods). */
export function paymentMethodLabel(method: string): string {
  const key = `common:payment.${method}.label`;
  return i18n.exists(key) ? i18n.t(key) : method;
}
