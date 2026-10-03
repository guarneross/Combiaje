import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Esqueleto de una tarjeta de ruta: franja de color, número, nombre, distancia. */
export function RouteCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-1.5 rounded-full" />
      <Skeleton className="size-9 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function RouteListSkeleton({
  cantidad = 5,
  className,
}: {
  cantidad?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("divide-border/60 divide-y", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando rutas…</span>
      {Array.from({ length: cantidad }, (_, i) => (
        <RouteCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mientras MapLibre descarga el estilo y las primeras teselas. */
export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-map-surface relative size-full overflow-hidden", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando el mapa…</span>
      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,transparent_45%,var(--border)_45%,var(--border)_47%,transparent_47%),linear-gradient(45deg,transparent_60%,var(--border)_60%,var(--border)_61.5%,transparent_61.5%)] bg-[length:140px_140px] opacity-70" />
    </div>
  );
}
