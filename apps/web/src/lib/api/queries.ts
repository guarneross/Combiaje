import {
  NEARBY_DEFAULT_LIMIT,
  NEARBY_DEFAULT_RADIUS_M,
  type Bbox,
  type Coordinates,
} from "@combiaje/shared";
import { queryOptions } from "@tanstack/react-query";

import {
  buscarLugares,
  obtenerConcesionarias,
  obtenerParadas,
  obtenerRuta,
  obtenerRutaGeoJson,
  obtenerRutas,
  obtenerRutasCercanas,
  planearViaje as pedirPlan,
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
  lugares: (q: string) => ["lugares", q.trim().toLowerCase()] as const,
  plan: (origen: Coordinates, destino: Coordinates, maxCaminata: number) =>
    [
      "plan",
      {
        origen: [redondearCoordenada(origen.lng), redondearCoordenada(origen.lat)],
        destino: [redondearCoordenada(destino.lng), redondearCoordenada(destino.lat)],
        maxCaminata,
      },
    ] as const,
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

/**
 * `GET /geocode?q=`
 *
 * `staleTime` largo a propósito: dónde está una colonia no cambia, y cada
 * respuesta que se reusa es una petición menos a un servicio gratuito ajeno.
 * Quien escribe y borra la misma palabra no vuelve a pedir nada.
 *
 * **El antirrebote NO vive aquí**, vive en la pantalla: sin él, una consulta
 * por cada tecla. Ver `use-debounce.ts`.
 */
export const lugaresQuery = (q: string) =>
  queryOptions({
    queryKey: claves.lugares(q),
    queryFn: ({ signal }) => buscarLugares({ q: q.trim() }, { signal }),
    staleTime: 30 * MINUTO,
  });

/**
 * `POST /trip-plan`.
 *
 * Es un POST y aun así se consulta como una lectura: el cuerpo lleva dos
 * coordenadas, no cambia nada del servidor, y la respuesta para el mismo par
 * origen-destino es la misma. Tratarlo como mutación obligaría a disparar el
 * plan a mano cada vez que cambia el destino, y a manejar su estado a mano.
 *
 * Las coordenadas se redondean en la clave por lo mismo que en `/nearby`: el
 * GPS tiembla unos metros aunque el usuario esté quieto, y sin redondear cada
 * lectura sería un plan nuevo.
 */
export const planQuery = (args: {
  origen: Coordinates;
  destino: Coordinates;
  maxWalkM?: number;
}) => {
  const maxCaminata = args.maxWalkM ?? 800;
  return queryOptions({
    queryKey: claves.plan(args.origen, args.destino, maxCaminata),
    queryFn: ({ signal }) =>
      pedirPlan(
        {
          origin: { lat: redondearCoordenada(args.origen.lat), lng: redondearCoordenada(args.origen.lng) },
          destination: args.destino,
          maxWalkM: maxCaminata,
        },
        { signal },
      ),
    staleTime: 5 * MINUTO,
  });
};

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
