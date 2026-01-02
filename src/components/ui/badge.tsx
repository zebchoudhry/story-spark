import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        hot: "border-red-500/30 bg-red-500/20 text-red-400",
        warm: "border-amber-500/30 bg-amber-500/20 text-amber-400",
        cold: "border-blue-400/30 bg-blue-400/20 text-blue-400",
        ufo: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
        paranormal: "border-violet-500/30 bg-violet-500/20 text-violet-400",
        true_crime: "border-red-600/30 bg-red-600/20 text-red-400",
        cryptid: "border-green-500/30 bg-green-500/20 text-green-400",
        conspiracy: "border-amber-600/30 bg-amber-600/20 text-amber-400",
        unresolved: "border-rose-500/30 bg-rose-500/20 text-rose-400",
        weird: "border-cyan-500/30 bg-cyan-500/20 text-cyan-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
