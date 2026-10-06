"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { obtenerRutaGeoJson, rutasQuery } from "@/lib/api";
import { env } from "@/lib/env";

/**
 * De dónde salen los trazos del mapa.
 *
 * Hay dos caminos y el resto de la aplicación no debe enterarse de cuál está
 * activo:
 *
 * 1. **Producción — teselas vectoriales.** Un archivo `.pmtiles` precalculado
 *    con tippecanoe. MapLibre lee por rangos HTTP solo las teselas visibles.
 *    Es lo que permite que 100 rutas no maten un teléfono de gama media.
 *
 * 2. **Desarrollo — GeoJSON de las rutas simuladas.** Mientras no exista el
 *    dataset no hay archivo de teselas que generar, así que se piden los
 *    GeoJSON de las rutas publicadas y se juntan en una sola fuente.
 *
 * ⚠️ El camino 2 es SOLO para desarrollo con las diez rutas simuladas. Con el
 * dataset real serían decenas de megabytes. Si algún día alguien lo usa en
 * producción "porque es más simple", la aplicación se cae en la calle.
 */

export type FuenteRutas =
  | { tipo: "vector"; url: string }
  | { tipo: "geojson"; datos: FeatureCollection; cargando: boolean; error: boolean };

export function useRoutesSource(): FuenteRutas {
  const urlTeselas = env.NEXT_PUBLIC_ROUTES_PMTILES_URL;
  const usarTeselas = Boolean(urlTeselas);

  // Las consultas se declaran siempre —los hooks no se pueden llamar
  // condicionalmente— pero quedan deshabilitadas cuando hay teselas.
  const listado = useQuery({ ...rutasQuery({ limit: 100 }), enabled: !usarTeselas });

  const geojsons = useQueries({
    queries: (listado.data?.items ?? []).map((ruta) => ({
      queryKey: ["rutas", "geojson", ruta.slug],
      queryFn: ({ signal }: { signal: AbortSignal }) => obtenerRutaGeoJson(ruta.slug, { signal }),
      staleTime: 60 * 60_000,
      enabled: !usarTeselas,
    })),
  });

  const datos = useMemo<FeatureCollection>(() => {
    const porSlug = listado.data?.items ?? [];
    const features: Feature[] = [];

    geojsons.forEach((consulta, i) => {
      const ruta = porSlug[i];
      if (!consulta.data || !ruta) return;
      for (const feature of consulta.data.features) {
        features.push({
          type: "Feature",
          geometry: feature.geometry as Geometry,
          properties: {
            ...feature.properties,
            // El `slug` no viene en el GeoJSON del contrato, y las capas lo
            // necesitan para resaltar. Se inyecta aquí.
            slug: ruta.slug,
            shortName: ruta.shortName,
          },
        });
      }
    });

    return { type: "FeatureCollection", features };
  }, [geojsons, listado.data]);

  if (usarTeselas) return { tipo: "vector", url: urlTeselas! };

  return {
    tipo: "geojson",
    datos,
    cargando: listado.isPending || geojsons.some((c) => c.isPending),
    error: listado.isError || geojsons.some((c) => c.isError),
  };
}
