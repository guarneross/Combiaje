import { NEARBY_DEFAULT_LIMIT, NEARBY_DEFAULT_RADIUS_M, type Bbox } from "@combiaje/shared";
import { queryOptions } from "@tanstack/react-query";

import {
  obtenerConcesionarias,
  obtenerParadas,
  obtenerRuta,
  obtenerRutaGeoJson,
  obtenerRutas,
  obtenerRutasCercanas,
  type FiltrosRutas,
} from "./endpoints";

const MINUTO = 60_000;

/**
 * El GPS de un celular tiembla unos metros aunque el usuario esté quieto.
 * Sin redondear, cada lectura sería una clave de caché distinta y pediríamos
 * `/nearby` una y otra vez por nada. Cuatro decimales son ~11 metros: por
 * debajo de eso, la respuesta es la misma.
 */
function redondearCoordenada(valor: number): number {
  return Math.round(valor * 10_000) / 10_000;
}

/** Claves de caché. Jerárquicas, para poder invalidar por rama. */
export const claves = {
  rutas: {
    todo: () => ["rutas"] as const,
    lista: (filtros: FiltrosRutas) => ["rutas", "lista", filtros] as const,
    ficha: (slug: string) => ["rutas", "ficha", slug] as const,
    geojson: (slug: string) => ["rutas", "geojson", slug] as const,
  },
  concesionarias: () => ["concesionarias"] as const,
  paradas: (bbox: Bbox) => ["paradas", bbox] as const,
  cercanas: (lat: number, lng: number, radio: number) =>
    ["cercanas", { lat: redondearCoordenada(lat), lng: redondearCoordenada(lng), radio }] as const,
} as const;

/**
 * Tiempos de frescura. El criterio: ¿cada cuánto cambia esto de verdad?
 * Las rutas de Puebla no cambian de trazo en una sesión; la posición del
 * usuario, sí.
 */
export const rutasQuery = (filtros: FiltrosRutas = {}) =>
  queryOptions({
    queryKey: claves.rutas.lista(filtros),
    queryFn: ({ signal }) => obtenerRutas(filtros, { signal }),
    staleTime: 10 * MINUTO,
  });

export const rutaQuery = (slug: string) =>
  queryOptions({
    queryKey: claves.rutas.ficha(slug),
    queryFn: ({ signal }) => obtenerRuta(slug, { signal }),
    staleTime: 10 * MINUTO,
  });

export const rutaGeoJsonQuery = (slug: string) =>
  queryOptions({
    queryKey: claves.rutas.geojson(slug),
    queryFn: ({ signal }) => obtenerRutaGeoJson(slug, { signal }),
    // La geometría es lo más caro de traer y lo que menos cambia.
    staleTime: 60 * MINUTO,
  });

export const concesionariasQuery = () =>
  queryOptions({
    queryKey: claves.concesionarias(),
    queryFn: ({ signal }) => obtenerConcesionarias({ signal }),
    staleTime: 60 * MINUTO,
  });

export const paradasQuery = (bbox: Bbox) =>
  queryOptions({
    queryKey: claves.paradas(bbox),
    queryFn: ({ signal }) => obtenerParadas(bbox, { signal }),
    staleTime: 30 * MINUTO,
  });

export const cercanasQuery = (args: {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}) => {
  const radio = args.radius ?? NEARBY_DEFAULT_RADIUS_M;
  return queryOptions({
    queryKey: claves.cercanas(args.lat, args.lng, radio),
    queryFn: ({ signal }) =>
      obtenerRutasCercanas(
        {
          lat: redondearCoordenada(args.lat),
          lng: redondearCoordenada(args.lng),
          radius: radio,
          limit: args.limit ?? NEARBY_DEFAULT_LIMIT,
        },
        { signal },
      ),
    staleTime: 2 * MINUTO,
  });
};
