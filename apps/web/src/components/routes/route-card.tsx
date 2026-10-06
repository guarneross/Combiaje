import Link from "next/link";
import type { RouteSummary } from "@combiaje/shared";

import { cn, formatDistance, formatFare } from "@/lib/utils";

type RutaMinima = Pick<RouteSummary, "slug" | "shortName" | "longName" | "color"> &
  Partial<Pick<RouteSummary, "agency" | "fareCents" | "colorSecondary" | "denominations">>;

/**
 * Tarjeta de ruta.
 *
 * La franja de color de la izquierda es el mismo color con el que la ruta se
 * pinta en el mapa: es lo que permite reconocerla sin leer.
 *
 * Dos modos: enlace a la ficha (catálogo) o botón que resalta la ruta en el
 * mapa sin cambiar de pantalla (pantalla principal).
 */
export function RouteCard({
  ruta,
  distanciaM,
  como = "enlace",
  activa = false,
  onClick,
  className,
}: {
  ruta: RutaMinima;
  distanciaM?: number;
  como?: "enlace" | "boton";
  activa?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const tarifa = ruta.fareCents !== undefined ? formatFare(ruta.fareCents) : null;
  /** Durante la renumeración de la SMT, el número que la gente todavía usa. */
  const anterior = ruta.denominations?.find((d) => !d.current)?.shortName;

  const contenido = (
    <>
      <span
        aria-hidden="true"
        className="h-10 w-1.5 shrink-0 rounded-full"
        style={{
          background: ruta.colorSecondary
            ? `linear-gradient(${ruta.color} 50%, ${ruta.colorSecondary} 50%)`
            : ruta.color,
        }}
      />

      <span
        className="grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1.5 text-sm font-bold text-white"
        style={{ backgroundColor: ruta.color }}
      >
        {ruta.shortName}
      </span>

      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{ruta.longName}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {anterior ? (
            <span className="bg-muted text-foreground/70 mr-1.5 rounded px-1 py-0.5 text-[10px] font-medium">
              antes {anterior}
            </span>
          ) : null}
          {ruta.agency?.shortName ?? ruta.agency?.name}
          {tarifa ? ` · ${tarifa}` : null}
        </span>
      </span>

      {distanciaM !== undefined ? (
        <span data-slot="distance" className="text-muted-foreground shrink-0 text-xs">
          a {formatDistance(distanciaM)}
        </span>
      ) : null}
    </>
  );

  const clases = cn(
    "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors",
    activa ? "bg-accent" : "hover:bg-accent/60 focus-visible:bg-accent/60",
    className,
  );

  if (como === "boton") {
    return (
      <button type="button" onClick={onClick} aria-pressed={activa} className={clases}>
        {contenido}
      </button>
    );
  }

  return (
    <Link href={`/rutas/${ruta.slug}`} className={clases}>
      {contenido}
    </Link>
  );
}
