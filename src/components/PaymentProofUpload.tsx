import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { friendlyErrorMessage } from "../lib/errors";
import { uploadPaymentProof } from "../lib/api";
import { Button } from "./ui/Button";

/**
 * Lets the customer upload a receipt/screenshot directly from the site
 * instead of only through WhatsApp. Uploading doesn't touch the booking by
 * itself — the RPC re-validates booking_number + phone/email server-side
 * (same check as looking the booking up), so this can't be used to tamper
 * with someone else's booking.
 */
export function PaymentProofUpload({
  bookingNumber,
  contact,
  onUploaded,
}: {
  bookingNumber: string;
  contact: string;
  onUploaded?: (status: string) => void;
}) {
  const { t } = useTranslation("booking");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPaymentProof(bookingNumber, contact, file);
      setDone(true);
      onUploaded?.(result.status);
    } catch (err) {
      setError(friendlyErrorMessage(err, "booking:proof.failed", "PaymentProofUpload.upload"));
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return <p className="text-sm font-semibold text-green-700">{t("proof.done")}</p>;
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        fullWidth
        disabled={uploading || !bookingNumber || !contact}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? t("proof.uploading") : t("proof.upload")}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
