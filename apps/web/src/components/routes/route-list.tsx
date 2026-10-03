"use client";

import { useQuery } from "@tanstack/react-query";
import { RouteOff } from "lucide-react";

import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { ApiError, rutasQuery, type FiltrosRutas } from "@/lib/api";

import { RouteCard } from "./route-card";

/**
 * Catálogo de rutas. Provisional: el bloque 5 le agrega búsqueda, filtros y
 * la vista partida de escritorio. Existe desde ya para que la capa de datos
 * se pueda ver funcionando y no solo compilar.
 */
export function RouteList({ filtros = {} }: { filtros?: FiltrosRutas }) {
  const { data, isPending, error, refetch, isFetching } = useQuery(rutasQuery(filtros));

  if (isPending) return <RouteListSkeleton cantidad={6} />;

  if (error) {
    const api = error instanceof ApiError ? error : null;
    return (
      <ErrorState
        descripcion={api?.mensajeParaUsuario ?? "Revisa tu conexión y vuelve a intentar."}
        detalle={error.message}
        onReintentar={() => void refetch()}
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={RouteOff}
        titulo="No encontramos rutas"
        descripcion={
          filtros.q
            ? `Nada coincide con «${filtros.q}». Prueba con el número de la ruta o con una colonia.`
            : "Todavía no hay rutas publicadas en esta zona."
        }
      />
    );
  }

  return (
    <div aria-busy={isFetching}>
      <p className="text-muted-foreground px-4 py-2 text-xs" role="status" aria-live="polite">
        {data.total} {data.total === 1 ? "ruta" : "rutas"}
      </p>
      <ul className="divide-border/60 divide-y">
        {data.items.map((ruta) => (
          <li key={ruta.id}>
            <RouteCard ruta={ruta} />
          </li>
        ))}
      </ul>
    </div>
  );
}
