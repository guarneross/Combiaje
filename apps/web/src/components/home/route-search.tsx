"use client";

import { useQuery } from "@tanstack/react-query";
import { RouteOff, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { RouteCard } from "@/components/routes/route-card";
import { Input } from "@/components/ui/input";
import { ApiError, rutasQuery } from "@/lib/api";

/** Dos letras: con una sola, cualquier texto devuelve media ciudad. */
export const MINIMO_BUSQUEDA = 2;

export function SearchInput({
  texto,
  onTexto,
}: {
  texto: string;
  onTexto: (valor: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={texto}
        onChange={(e) => onTexto(e.target.value)}
        placeholder="Busca una ruta por número o destino"
        aria-label="Busca una ruta por número o destino"
        className="pl-9"
        enterKeyHint="search"
      />
    </div>
  );
}

/**
 * Resultados de la búsqueda.
 *
 * La búsqueda también encuentra por el número anterior: durante la renumeración
 * de la SMT, quien escribe «38A» tiene que dar con la que hoy es 061.
 */
export function SearchResults({
  texto,
  onSeleccionar,
  rutaSeleccionada,
}: {
  texto: string;
  onSeleccionar: (slug: string) => void;
  rutaSeleccionada?: string | null;
}) {
  const consulta = texto.trim();
  const activa = consulta.length >= MINIMO_BUSQUEDA;

  const resultados = useQuery({ ...rutasQuery({ q: consulta, limit: 20 }), enabled: activa });

  if (!activa) return null;
  if (resultados.isPending) return <RouteListSkeleton cantidad={3} />;

  if (resultados.error) {
    return (
      <ErrorState
        descripcion={
          resultados.error instanceof ApiError
            ? resultados.error.mensajeParaUsuario
            : "Revisa tu conexión y vuelve a intentar."
        }
        onReintentar={() => void resultados.refetch()}
        className="py-6"
      />
    );
  }

  if (resultados.data.items.length === 0) {
    return (
      <EmptyState
        icon={RouteOff}
        titulo="Ninguna ruta coincide"
        descripcion={`Nada con «${consulta}». Prueba con el número del parabrisas o con una colonia.`}
        className="py-6"
      />
    );
  }

  return (
    <div>
      <p className="text-muted-foreground px-1 pb-1 text-xs" role="status" aria-live="polite">
        {resultados.data.total} {resultados.data.total === 1 ? "resultado" : "resultados"}
      </p>
      <ul className="divide-border/60 -mx-4 divide-y border-y">
        {resultados.data.items.map((ruta) => (
          <li key={ruta.id}>
            <RouteCard
              ruta={ruta}
              como="boton"
              activa={rutaSeleccionada === ruta.slug}
              onClick={() => onSeleccionar(ruta.slug)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
