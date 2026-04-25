import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        brand:
          "border-brand/30 bg-brand-muted text-brand-foreground dark:bg-brand-muted/50 dark:text-foreground",
        success:
          "border-success/30 bg-success/10 text-success dark:text-success",
        warning:
          "border-warning/30 bg-warning/10 text-warning dark:text-warning",
        danger:
          "border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive",
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
