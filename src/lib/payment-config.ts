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

/** i18n key segment (booking:payment.<segment>.*) for each DB payment_method value. */
const METHOD_KEY: Record<PaymentMethod, string> = {
  bank_transfer: "bankTransfer",
  instapay: "instapay",
  vodafone_cash: "vodafoneCash",
};

/** Localised display name of a payment method (e.g. on the confirmation page). */
export function paymentMethodLabel(value: PaymentMethod): string {
  return i18n.t(`booking:payment.${METHOD_KEY[value]}.label`);
}

/**
 * Payment options in the CURRENT UI language. Built on every call (not once at import time)
 * so the labels follow a language switch; the account details themselves stay the same.
 */
export function getPaymentMethods(): PaymentMethodOption[] {
  return [
    {
      value: "bank_transfer",
      label: paymentMethodLabel("bank_transfer"),
      details: i18n.t("booking:payment.bankTransfer.details", {
        bank: BANK_NAME,
        iban: BANK_IBAN,
        account: BANK_ACCOUNT_NAME,
      }),
    },
    {
      value: "instapay",
      label: paymentMethodLabel("instapay"),
      details: i18n.t("booking:payment.instapay.details", { handle: INSTAPAY_HANDLE }),
    },
    {
      value: "vodafone_cash",
      label: paymentMethodLabel("vodafone_cash"),
      details: i18n.t("booking:payment.vodafoneCash.details", { number: VODAFONE_CASH_NUMBER }),
    },
  ];
}

/** Hook version of getPaymentMethods() — re-renders the caller when the language changes. */
export function usePaymentMethods(): PaymentMethodOption[] {
  useTranslation("booking");
  return getPaymentMethods();
}
