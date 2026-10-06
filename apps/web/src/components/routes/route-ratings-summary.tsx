import { Star } from "lucide-react";
import { RATING_DIMENSIONS, type RouteRatingStats } from "@combiaje/shared";

import { cn } from "@/lib/utils";

/**
 * Calificación agregada de una ruta.
 *
 * Los promedios llegan en `null` cuando nadie ha calificado. Un promedio de
 * cero sería una afirmación falsa —«esta ruta es pésima»—; la ausencia de
 * datos no lo es, y se dice con todas sus letras.
 */
export function RouteRatingsSummary({
  estadisticas,
  className,
}: {
  estadisticas: RouteRatingStats | null;
  className?: string;
}) {
  if (!estadisticas || estadisticas.ratingsCount === 0) {
    return (
      <section className={cn("space-y-1", className)}>
        <h2 className="text-sm font-semibold">Calificación</h2>
        <p className="text-muted-foreground text-sm">
          Todavía nadie la ha calificado. Si la usas, tu opinión va a ser la primera.
        </p>
      </section>
    );
  }

  const general = estadisticas.avgOverall ?? 0;

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="calificacion">
      <h2 id="calificacion" className="text-sm font-semibold">
        Calificación
      </h2>

      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold tabular-nums">{general.toFixed(1)}</span>
        <span className="flex" aria-label={`${general.toFixed(1)} de 5 estrellas`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden="true"
              className={cn(
                "size-4",
                n <= Math.round(general)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40",
              )}
            />
          ))}
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {estadisticas.ratingsCount}{" "}
          {estadisticas.ratingsCount === 1 ? "calificación" : "calificaciones"}
        </span>
      </div>

      <dl className="grid gap-2">
        {RATING_DIMENSIONS.map(({ key, label }) => {
          const valor = estadisticas[
            `avg${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof RouteRatingStats
          ] as number | null;
          if (valor === null || valor === undefined) return null;
          return (
            <div key={key} className="flex items-center gap-3">
              <dt className="text-muted-foreground w-36 shrink-0 text-xs">{label}</dt>
              <dd className="flex min-w-0 flex-1 items-center gap-2">
                <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-primary block h-full rounded-full"
                    style={{ width: `${(valor / 5) * 100}%` }}
                  />
                </span>
                <span className="w-7 shrink-0 text-right text-xs tabular-nums">
                  {valor.toFixed(1)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
