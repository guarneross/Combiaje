import Link from "next/link";
import type { RouteSummary } from "@combiaje/shared";

import { cn, formatFare } from "@/lib/utils";

/**
 * Tarjeta de ruta. La franja de color de la izquierda es el mismo color con
 * el que la ruta se pinta en el mapa: es lo que permite reconocerla sin leer.
 */
export function RouteCard({
  ruta,
  distanciaM,
  className,
}: {
  ruta: Pick<RouteSummary, "slug" | "shortName" | "longName" | "color"> &
    Partial<Pick<RouteSummary, "agency" | "fareCents">>;
  distanciaM?: number;
  className?: string;
}) {
  const tarifa = ruta.fareCents !== undefined ? formatFare(ruta.fareCents) : null;

  return (
    <Link
      href={`/rutas/${ruta.slug}`}
      className={cn(
        "hover:bg-accent/60 focus-visible:bg-accent/60 flex min-h-16 items-center gap-3 px-4 py-3 transition-colors",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-10 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: ruta.color }}
      />

      <span
        className="grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1.5 text-sm font-bold text-white"
        style={{ backgroundColor: ruta.color }}
      >
        {ruta.shortName}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{ruta.longName}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {ruta.agency?.shortName ?? ruta.agency?.name}
          {tarifa ? ` · ${tarifa}` : null}
        </span>
      </span>

      {distanciaM !== undefined ? (
        <span data-slot="distance" className="text-muted-foreground shrink-0 text-xs">
          a {distanciaM < 1000 ? `${Math.round(distanciaM / 10) * 10} m` : `${(distanciaM / 1000).toFixed(1)} km`}
        </span>
      ) : null}
    </Link>
  );
}
