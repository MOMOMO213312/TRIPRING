import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/utils";

export function DestinationCard({
  to,
  image,
  title,
  subtitle,
  price,
  currency = "USD",
  priceLabel = "رحلات ذهاب وعودة ابتداءً من",
  badge,
}: {
  to: string;
  image: string | null;
  title: string;
  subtitle?: string;
  price?: number | null;
  currency?: string;
  priceLabel?: string;
  badge?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="opportunity-card-lift group relative block h-[300px] w-[220px] shrink-0 overflow-hidden rounded-xl sm:h-[340px] sm:w-[250px]"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
          <span className="text-4xl">✈</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {badge ? <div className="absolute start-3 top-3">{badge}</div> : null}
      <div className="absolute bottom-0 start-0 end-0 p-4">
        <p className="text-base font-bold text-white">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-white/70">{subtitle}</p> : null}
        {price != null ? (
          <>
            <p className="mt-1 text-xs text-white/70">{priceLabel}</p>
            <p className="font-latin mt-0.5 text-lg font-extrabold text-white">{formatPrice(price, currency)}</p>
          </>
        ) : null}
      </div>
    </Link>
  );
}
