"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { rutaGeoJsonQuery, rutasQuery } from "@/lib/api";
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
 * 2. **Desarrollo — GeoJSON de las rutas publicadas.** Mientras no exista el
 *    archivo de teselas se piden los GeoJSON de las rutas que la pantalla
 *    necesita y se juntan en una sola fuente.
 *
 * ⚠️ El camino 2 es SOLO para desarrollo y para un puñado de rutas. Con el
 * dataset completo serían decenas de megabytes. Si algún día alguien lo usa en
 * producción "porque es más simple", la aplicación se cae en la calle.
 *
 * **`slugs` es lo que decide qué se descarga.** Antes esta función pedía la
 * geometría de todas las rutas del catálogo al montar el mapa, y la pantalla
 * principal abría pintando la ciudad entera: con dos rutas trazadas ya era una
 * maraña, y con diez habría sido ilegible. Ahora `[]` no descarga nada —el
 * mapa abre limpio— y la pantalla pide lo que de verdad va a dibujar.
 * `null` sigue significando «todas», para la vista de la red completa.
 */

export type FuenteRutas =
  | { tipo: "vector"; url: string }
  | { tipo: "geojson"; datos: FeatureCollection; cargando: boolean; error: boolean };

export function useRoutesSource(slugs: readonly string[] | null): FuenteRutas {
  const urlTeselas = env.NEXT_PUBLIC_ROUTES_PMTILES_URL;
  const usarTeselas = Boolean(urlTeselas);

  // El catálogo se pide siempre (lo comparte con el buscador, así que suele
  // estar en caché) porque de ahí sale el número de ruta, que el GeoJSON del
  // contrato no trae.
  const listado = useQuery({ ...rutasQuery({ limit: 100 }), enabled: !usarTeselas });

  const pedidas = useMemo(() => {
    const catalogo = listado.data?.items ?? [];
    if (slugs === null) return catalogo;
    const buscadas = new Set(slugs);
    return catalogo.filter((ruta) => buscadas.has(ruta.slug));
  }, [listado.data, slugs]);

  const geojsons = useQueries({
    queries: pedidas.map((ruta) => ({
      ...rutaGeoJsonQuery(ruta.slug),
      enabled: !usarTeselas,
    })),
  });

  const datos = useMemo<FeatureCollection>(() => {
    const features: Feature[] = [];

    geojsons.forEach((consulta, i) => {
      const ruta = pedidas[i];
      if (!consulta.data || !ruta) return;
      for (const feature of consulta.data.features) {
        features.push({
          type: "Feature",
          geometry: feature.geometry as Geometry,
          properties: {
            ...feature.properties,
            // El `slug` no viene en el GeoJSON del contrato, y las capas lo
            // necesitan para filtrar, resaltar y desfasar. Se inyecta aquí.
            slug: ruta.slug,
            shortName: ruta.shortName,
          },
        });
      }
    });

    return { type: "FeatureCollection", features };
  }, [geojsons, pedidas]);

  if (usarTeselas) return { tipo: "vector", url: urlTeselas! };

  return {
    tipo: "geojson",
    datos,
    // Si no se pidió nada, no hay nada que esperar.
    cargando: pedidas.length > 0 && geojsons.some((c) => c.isPending),
    error: listado.isError || geojsons.some((c) => c.isError),
  };
}
