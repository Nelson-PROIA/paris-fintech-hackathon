import { cn } from "@/lib/utils";

/**
 * Loanly logomark — geometric, minimal, no circle, no letter-in-shape.
 * Two stacked bars + a thin diagonal "lift" stroke representing capital flow.
 * Pairs with the "Loanly" wordmark.
 */
export function LoanlyMark({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0 text-foreground", className)}
    >
      {/* Tall stem (the "L" stroke, but freed from a frame) */}
      <rect x="3" y="3" width="3" height="18" rx="1.2" fill="currentColor" />
      {/* Base bar */}
      <rect x="3" y="18" width="13" height="3" rx="1.2" fill="currentColor" />
      {/* Brand-tinted ascending stroke — represents capital lifting */}
      <rect
        x="9"
        y="3"
        width="3"
        height="11"
        rx="1.2"
        fill="currentColor"
        opacity="0.35"
      />
      <rect
        x="15"
        y="9"
        width="3"
        height="9"
        rx="1.2"
        fill="var(--brand, currentColor)"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. Use in nav, footer, sign-in side panel.
 */
export function LoanlyLogo({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LoanlyMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">
        Loanly
      </span>
    </span>
  );
}
