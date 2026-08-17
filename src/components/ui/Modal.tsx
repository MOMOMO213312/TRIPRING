import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <h3 className="text-lg font-bold text-gray-900">{title}</h3> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
