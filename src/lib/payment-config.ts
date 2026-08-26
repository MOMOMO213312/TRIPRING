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

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; details: string }[] = [
  {
    value: "bank_transfer",
    label: "تحويل بنكي",
    details: `البنك: ${BANK_NAME} · IBAN: ${BANK_IBAN} · اسم الحساب: ${BANK_ACCOUNT_NAME}`,
  },
  {
    value: "instapay",
    label: "InstaPay",
    details: `معرّف InstaPay: ${INSTAPAY_HANDLE}`,
  },
  {
    value: "vodafone_cash",
    label: "Vodafone Cash",
    details: `رقم المحفظة: ${VODAFONE_CASH_NUMBER}`,
  },
];
