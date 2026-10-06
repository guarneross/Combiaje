"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";
import { RouteOff, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { Input } from "@/components/ui/input";
import { ApiError, concesionariasQuery, rutasQuery } from "@/lib/api";
import { cn } from "@/lib/utils";

import { RouteCard } from "./route-card";

/**
 * Catálogo de rutas con búsqueda y filtro por concesionaria.
 *
 * El texto y el filtro viven en la URL: un enlace a «todas las rutas de AUP que
 * digan Centro» tiene que abrir exactamente eso.
 *
 * La búsqueda encuentra también por el **número anterior**, que durante la
 * renumeración de la SMT es con el que la gente va a buscar.
 */
export function RouteCatalog() {
  const [{ q, concesionaria }, setFiltros] = useQueryStates(
    { q: parseAsString.withDefault(""), concesionaria: parseAsString },
    { history: "replace", shallow: true },
  );

  const concesionarias = useQuery(concesionariasQuery());
  const rutas = useQuery(
    rutasQuery({
      q: q.trim() || undefined,
      agency: concesionaria ?? undefined,
      limit: 100,
    }),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => void setFiltros({ q: e.target.value || null })}
            placeholder="Número, destino o colonia"
            aria-label="Buscar rutas"
            className="pl-9"
            enterKeyHint="search"
          />
        </div>

        {/* Filtro por concesionaria. Se oculta mientras no haya ninguna. */}
        {concesionarias.data && concesionarias.data.length > 0 ? (
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Filtrar por concesionaria"
          >
            <Chip activo={!concesionaria} onClick={() => void setFiltros({ concesionaria: null })}>
              Todas
            </Chip>
            {concesionarias.data.map((c) => (
              <Chip
                key={c.id}
                activo={concesionaria === c.id}
                onClick={() =>
                  void setFiltros({ concesionaria: concesionaria === c.id ? null : c.id })
                }
              >
                {c.shortName ?? c.name}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rutas.isPending ? (
          <RouteListSkeleton cantidad={8} />
        ) : rutas.error ? (
          <ErrorState
            descripcion={
              rutas.error instanceof ApiError
                ? rutas.error.mensajeParaUsuario
                : "Revisa tu conexión y vuelve a intentar."
            }
            onReintentar={() => void rutas.refetch()}
          />
        ) : rutas.data.items.length === 0 ? (
          <EmptyState
            icon={RouteOff}
            titulo="Ninguna ruta coincide"
            descripcion={
              q.trim() || concesionaria
                ? "Prueba con el número del parabrisas, con una colonia, o quita el filtro."
                : "Todavía no hay rutas publicadas. El dataset se está levantando a mano, ruta por ruta."
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground px-4 py-2 text-xs" role="status" aria-live="polite">
              {rutas.data.total} {rutas.data.total === 1 ? "ruta" : "rutas"}
            </p>
            <ul className="divide-border/60 divide-y">
              {rutas.data.items.map((ruta) => (
                <li key={ruta.id}>
                  <RouteCard ruta={ruta} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
        activo
          ? "bg-primary text-primary-foreground border-transparent"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
