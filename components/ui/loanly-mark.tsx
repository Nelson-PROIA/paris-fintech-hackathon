import { cn } from "@/lib/utils";

/**
 * Wordmark-only Loanly logo. No symbol, no circle, no letter-in-shape.
 * The brand IS the typography. Tight tracking, optical-size adjusted.
 *
 * Renders as inline-flex span so it composes cleanly inside links/buttons.
 */
export function LoanlyLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "text-[14px]"
      : size === "lg"
        ? "text-[22px]"
        : "text-[16px]";
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-[-0.04em]",
        sizeClass,
        className
      )}
    >
      <span>Loanly</span>
      <span className="text-brand" aria-hidden>
        .
      </span>
    </span>
  );
}

/**
 * Backwards-compat shim for callers still importing the symbol-only mark.
 * Kept so existing pages keep building — renders the dot-period accent only.
 * New code should use LoanlyLogo directly.
 */
export function LoanlyMark({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-sm bg-brand",
        className
      )}
      style={{ width: Math.round(size / 5), height: size, aspectRatio: "1 / 5" }}
      aria-hidden
    />
  );
}
