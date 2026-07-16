import Link from "next/link";
import { Star } from "lucide-react";
import type { Gig } from "@/lib/types";
import { StatusChip } from "./StatusChip";

function formatGhs(price: number) {
  return `GHS ${Number(price).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function rating(gig: Gig) {
  if (!gig.starNumber) return null;
  return (gig.totalStars || 0) / gig.starNumber;
}

export function GigCard({ gig }: { gig: Gig }) {
  const stars = rating(gig);
  return (
    <Link
      href={`/gigs/${gig._id}`}
      className="group block bg-surface-container-lowest border border-outline-variant rounded-card overflow-hidden hover:shadow-[0_4px_12px_rgba(18,25,22,0.05)] transition"
    >
      <div className="aspect-[16/10] bg-surface-container overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gig.cover || "/placeholder-gig.svg"}
          alt={gig.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
        />
      </div>
      <div className="p-md space-y-sm">
        <div className="flex items-start justify-between gap-sm">
          <p className="font-label-caps text-on-surface-variant">{gig.cat}</p>
          {gig.status && gig.status !== "approved" ? (
            <StatusChip status={gig.status} />
          ) : null}
        </div>
        <h3 className="font-section-title text-primary line-clamp-2">
          {gig.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-data-price text-primary">
            {formatGhs(gig.price)}
          </span>
          {stars !== null ? (
            <span className="flex items-center gap-1 font-body-dense text-on-surface-variant">
              <Star className="w-3.5 h-3.5 fill-secondary-container text-secondary-container" />
              {stars.toFixed(1)}
            </span>
          ) : (
            <span className="font-body-dense text-on-surface-variant">New</span>
          )}
        </div>
        {gig.location?.city ? (
          <p className="font-body-dense text-on-surface-variant">
            {gig.location.city}
            {gig.location.region ? `, ${gig.location.region}` : ""}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
