import type { Denomination } from "@combiaje/shared";

import { cn } from "@/lib/utils";

/**
 * Historial de números y colores de una ruta.
 *
 * Existe por la renumeración que la SMT arrancó en septiembre de 2026: 95
 * rutas cambian de número y color hasta antes de 2028. Durante esos dos años
 * la gente va a conocer el número viejo mientras el camión trae el nuevo, y
 * esta correspondencia es lo que nadie más va a guardar — un dato
 * institucional sobrescribe lo que dejó de ser cierto.
 */
export function RouteDenominations({
  denominaciones,
  className,
}: {
  denominaciones: Denomination[];
  className?: string;
}) {
  if (denominaciones.length < 2) return null;

  // De la más reciente a la más vieja: lo vigente primero.
  const orden = [...denominaciones].reverse();

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="historial-nombres">
      <h2 id="historial-nombres" className="text-sm font-semibold">
        Cómo se ha llamado
      </h2>

      <ol className="space-y-2">
        {orden.map((d, i) => (
          <li key={`${d.shortName}-${i}`} className="flex items-center gap-3">
            <span aria-hidden="true" className="flex shrink-0 gap-0.5">
              {d.colors.map((color) => (
                <span
                  key={color}
                  className="h-6 w-2 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{d.shortName}</span>
                {d.current ? (
                  <span className="bg-success/15 text-success rounded px-1.5 py-0.5 text-[11px] font-medium">
                    Actual
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {d.until ? `hasta ${formatearFecha(d.until)}` : "nomenclatura anterior"}
                  </span>
                )}
              </span>
              {d.longName ? (
                <span className="text-muted-foreground block truncate text-xs">{d.longName}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground text-xs">
        La Secretaría de Movilidad y Transporte está cambiando el número y el color de 95 rutas del
        área metropolitana. Aquí guardamos las dos, para que puedas encontrar tu camión aunque lo
        conozcas por el nombre de antes.
      </p>
    </section>
  );
}

function formatearFecha(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(fecha);
}
