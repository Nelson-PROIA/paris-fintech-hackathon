import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[-0.005em] transition",
  {
    variants: {
      variant: {
        default:
          "border-border bg-secondary text-foreground",
        outline:
          "border-border bg-transparent text-foreground",
        brand:
          "border-brand/40 bg-brand-muted text-foreground dark:bg-brand-muted/50",
        success:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-300",
        warning:
          "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300",
        danger:
          "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-300",
        ghost: "border-transparent bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
