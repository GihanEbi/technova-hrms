import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only 1–5 rating display with partial-star precision. */
export function RatingStars({ value, className, showValue = true }: { value: number; className?: string; showValue?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Rating ${value.toFixed(1)} out of 5`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          return (
            <span key={i} className="relative size-3.5">
              <Star className="absolute inset-0 size-3.5 text-border" fill="currentColor" strokeWidth={0} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="size-3.5 text-amber-400" fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && <span className="text-sm font-medium tabular">{value.toFixed(1)}</span>}
    </span>
  );
}
