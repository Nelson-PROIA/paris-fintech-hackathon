import { CopyButton } from "./CopyButton";

/**
 * Compact one-liner for displaying a hex value (address, tx hash, bytes32 id)
 * with monospace formatting + a copy button. Long values wrap on small
 * screens but stay on one row on desktop thanks to `truncate` + `min-w-0`.
 */
export function AddressLine({
  label,
  value,
  short = false,
}: {
  label: string;
  value: string;
  /** When true, render `0xab12…cd34` instead of the full string. */
  short?: boolean;
}) {
  const display = short && value.length > 14
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <code className="break-all rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px]">
        {display}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
