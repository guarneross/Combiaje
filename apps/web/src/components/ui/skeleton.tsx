import { cn } from "@/lib/utils";

/**
 * Skeleton, no spinner. Un spinner en blanco no dice nada; un esqueleto le
 * dice al usuario qué forma va a tener lo que está esperando.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
