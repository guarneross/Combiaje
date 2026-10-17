import {
  NEARBY_DEFAULT_LIMIT,
  NEARBY_DEFAULT_RADIUS_M,
  PAGE_DEFAULT_LIMIT,
  type Agency,
  type NearbyResponse,
  type RouteDetail,
  type RouteSummary,
  STOP_KIND_LABEL,
  type Place,
  type Stop,
  type TripOption,
} from "@combiaje/shared";

import {
  CONCESIONARIAS_ACTIVAS,
  PARADAS,
  RUTAS,
  RUTAS_RESUMEN,
  type RutaSimulada,
} from "./dataset";
import {
  distanciaATrazo,
  distanciaEntre,
  proyectarEnTrazo,
  recuadroDe,
  type Posicion,
  type Proyeccion,
} from "./geo";

/**
 * Las consultas sobre el dataset de rutas, **sin HTTP de por medio**.
 *
 * Esto existe porque la misma lógica se usa en dos lados: los Route Handlers
 * que sirven la API en producción y los handlers de MSW que la simulan en
 * desarrollo y en las pruebas. Tenerla escrita dos veces es cómo se consigue
 * que el mapa se comporte distinto según dónde corra, y que una prueba en
 * verde no signifique nada.
 *
 * Nada de aquí toca la base de datos: las rutas viven en archivos, versionadas
 * en git, y las genera `pnpm rutas`. Lo único que vive en Postgres son las
 * calificaciones. Ver `db/migraciones/0001_calificaciones.sql`.
 */

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export interface FiltrosBusqueda {
  q?: string | null;
  agency?: string | null;
  page?: number;
  limit?: number;
}

export interface Paginado<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * `GET /routes`
 *
 * La búsqueda encuentra también por el **número anterior** de la ruta: durante
 * la renumeración de la SMT, quien escribe «38A» tiene que dar con la que hoy
 * es 061. Esa línea tiene su propia prueba.
 */
export function buscarRutas(filtros: FiltrosBusqueda = {}): Paginado<RouteSummary> {
  const page = Math.max(1, Math.trunc(filtros.page || 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(filtros.limit || PAGE_DEFAULT_LIMIT)));

  let encontradas: RouteSummary[] = RUTAS_RESUMEN;

  const q = filtros.q?.trim();
  if (q) {
    const aguja = normalizar(q);
    encontradas = encontradas.filter(
      (r) =>
        normalizar(r.shortName).includes(aguja) ||
        normalizar(r.longName).includes(aguja) ||
        normalizar(r.agency?.shortName ?? "").includes(aguja) ||
        (r.denominations ?? []).some((d) => normalizar(d.shortName).includes(aguja)),
    );
  }

  if (filtros.agency) {
    encontradas = encontradas.filter(
      (r) => r.agency?.id === filtros.agency || r.agency?.shortName === filtros.agency,
    );
  }

  const total = encontradas.length;
  const desde = (page - 1) * limit;

  return {
    items: encontradas.slice(desde, desde + limit),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** `GET /routes/:slug`. `null` si no existe. La geometría no viaja aquí. */
export function rutaPorSlug(slug: string): RouteDetail | null {
  const ruta = RUTAS.find((r) => r.slug === slug);
  if (!ruta) return null;
  const { geometrias: _geometrias, ...detalle } = ruta;
  return detalle as RouteDetail;
}

/** ¿Existe esta ruta? Lo usa `POST /routes/:slug/ratings` antes de escribir. */
export function existeRuta(slug: string): boolean {
  return RUTAS.some((r) => r.slug === slug);
}

/** `GET /routes/:slug/geojson`. `null` si no existe la ruta. */
export function geojsonDeRuta(slug: string) {
  const ruta = RUTAS.find((r) => r.slug === slug);
  if (!ruta) return null;

  return {
    type: "FeatureCollection" as const,
    bbox: recuadroDe(ruta.geometrias as Posicion[][]),
    features: ruta.variants.map((variante, i) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: ruta.geometrias[i]! },
      properties: {
        variantId: variante.id,
        routeId: ruta.id,
        name: variante.name,
        direction: variante.direction,
        color: ruta.color,
        isPrimary: variante.isPrimary,
      },
    })),
  };
}

/** `GET /agencies` */
export function concesionarias(): Agency[] {
  return CONCESIONARIAS_ACTIVAS;
}

/** `GET /stops?bbox=` */
export function paradasEn(bbox?: string | null): Stop[] {
  if (!bbox) return PARADAS;
  const [oeste, sur, este, norte] = bbox.split(",").map(Number);
  if ([oeste, sur, este, norte].some((n) => !Number.isFinite(n))) return PARADAS;
  return PARADAS.filter(
    (p) => p.lng >= oeste! && p.lng <= este! && p.lat >= sur! && p.lat <= norte!,
  );
}

export interface ConsultaCercanas {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}

/**
 * `GET /nearby`
 *
 * La distancia es al **trazo**, no al punto medio de la ruta: lo que importa
 * es a cuántos metros de caminata pasa el camión de donde estás parado.
 *
 * La ubicación que entra aquí no se guarda en ningún lado. Se usa para
 * responder y se descarta; no hay registro ni bitácora de coordenadas.
 */
export function rutasCercanas(consulta: ConsultaCercanas): NearbyResponse {
  const radio = consulta.radius ?? NEARBY_DEFAULT_RADIUS_M;
  const limite = consulta.limit ?? NEARBY_DEFAULT_LIMIT;
  const punto: Posicion = [consulta.lng, consulta.lat];

  const routes = RUTAS.map((ruta) => ({
    id: ruta.id,
    slug: ruta.slug,
    shortName: ruta.shortName,
    longName: ruta.longName,
    color: ruta.color,
    distanceM: Math.round(
      Math.min(...ruta.geometrias.map((g) => distanciaATrazo(punto, g as Posicion[]))),
    ),
  }))
    .filter((r) => r.distanceM <= radio)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limite);

  return { routes, radiusM: radio };
}

/**
 * Los lugares que Combiaje conoce por su cuenta: sus propias paradas.
 *
 * Van **antes** que los del geocodificador externo en `GET /geocode`, por dos
 * razones. Son los que tienen rutas encima, así que son los que de verdad
 * sirven de destino; y no dependen de que nadie conteste, así que la caja de
 * «¿a dónde vas?» nunca se queda completamente vacía porque un servicio de
 * terceros se haya caído.
 */
export function lugaresPropios(texto: string, limite = 5): Place[] {
  const aguja = normalizar(texto.trim());
  if (!aguja) return [];

  return PARADAS.filter((parada) => normalizar(parada.name).includes(aguja))
    .slice(0, limite)
    .map((parada) => ({
      // Prefijo de fuente: los lugares de OpenStreetMap no son filas nuestras
      // y sus identificadores no son UUID, así que el id es texto.
      id: `combiaje:${parada.id}`,
      name: parada.name,
      context: STOP_KIND_LABEL[parada.kind],
      lat: parada.lat,
      lng: parada.lng,
      kind: "stop" as const,
      source: "combiaje" as const,
    }));
}

export interface ConsultaViaje {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  maxWalkM?: number;
}

/**
 * Menos de esto a bordo y la respuesta honesta es «camina»: no vale la pena
 * esperar un camión para avanzar tres cuadras, y una opción así desprestigia
 * a todas las demás de la lista.
 */
const MINIMO_A_BORDO_M = 300;

/** A cuántos metros una parada conocida sirve para nombrar un punto del trazo. */
const RADIO_NOMBRE_M = 250;

/**
 * Cómo se le dice a un punto sobre el recorrido.
 *
 * Si hay una parada conocida al lado, se usa su nombre: «te subes en CAPU» es
 * una instrucción; «te subes en 19.0747, -98.2073» no es nada. Si no hay
 * ninguna cerca, se dice la verdad —que es un punto del recorrido— en lugar de
 * inventar una parada que no existe.
 */
function nombrarPunto(punto: Posicion, respaldo: string): string {
  let mejor: { nombre: string; distancia: number } | null = null;
  for (const parada of PARADAS) {
    const distancia = distanciaEntre(punto, [parada.lng, parada.lat]);
    if (distancia <= RADIO_NOMBRE_M && (!mejor || distancia < mejor.distancia)) {
      mejor = { nombre: parada.name, distancia };
    }
  }
  return mejor?.nombre ?? respaldo;
}

interface Candidata {
  ruta: RutaSimulada;
  indiceVariante: number;
  origen: Proyeccion;
  destino: Proyeccion;
}

const caminataDe = (c: Candidata) => c.origen.distanciaM + c.destino.distanciaM;
const aBordoDe = (c: Candidata) => c.destino.avanceM - c.origen.avanceM;

function armarOpcion(candidata: Candidata): TripOption {
  const { ruta, indiceVariante, origen, destino } = candidata;
  const variante = ruta.variants[indiceVariante]!;

  return {
    type: "direct",
    totalWalkM: Math.round(caminataDe(candidata)),
    legs: [
      { mode: "walk", distanceM: Math.round(origen.distanciaM) },
      {
        mode: "bus",
        routeId: ruta.id,
        routeSlug: ruta.slug,
        routeShortName: ruta.shortName,
        color: ruta.color,
        variantId: variante.id,
        variantName: variante.name,
        boardAt: {
          lat: origen.punto[1],
          lng: origen.punto[0],
          name: nombrarPunto(origen.punto, "Sobre el recorrido, cerca de ti"),
        },
        alightAt: {
          lat: destino.punto[1],
          lng: destino.punto[0],
          name: nombrarPunto(destino.punto, "Lo más cerca que te deja"),
        },
        onboardDistanceM: Math.round(aBordoDe(candidata)),
      },
      { mode: "walk", distanceM: Math.round(destino.distanciaM) },
    ],
  };
}

/**
 * `POST /trip-plan`, solo viajes directos.
 *
 * Una ruta sirve si pasa cerca del origen, cerca del destino **y en ese
 * orden**. Lo tercero es lo que antes faltaba: con solo las dos distancias,
 * toda ruta que pasa por los dos puntos aparecía dos veces —ida y vuelta— y
 * una de las dos te llevaba al lado opuesto. Por eso ahora cada punto se
 * proyecta sobre el trazo con `proyectarEnTrazo`, que además de la distancia
 * dice en qué kilómetro del recorrido cae, y se exige que el destino quede
 * más adelante que el origen.
 *
 * De cada ruta sale **una sola** opción: la variante que de verdad te lleva.
 * Y la distancia a bordo ya no es un porcentaje inventado del largo total,
 * sino los metros que hay entre donde subes y donde bajas.
 *
 * Lo que sigue faltando: transbordos (una sola ruta tiene que servir para todo
 * el viaje) y el tiempo, que necesita frecuencias y velocidades que nadie ha
 * medido todavía. Por eso la respuesta habla de metros y no de minutos.
 *
 * `rutas` se puede pasar para probar la regla del orden sobre un trazo hecho a
 * mano. En producción nadie lo pasa: el dataset real cambia cada vez que se
 * sube una ruta, y una prueba que dependa de él se rompe sin que nada esté
 * mal.
 */
export function planearViaje(consulta: ConsultaViaje, rutas: readonly RutaSimulada[] = RUTAS) {
  const maxCaminata = consulta.maxWalkM ?? 800;
  const origen: Posicion = [consulta.origin.lng, consulta.origin.lat];
  const destino: Posicion = [consulta.destination.lng, consulta.destination.lat];

  const candidatas: Candidata[] = [];

  for (const ruta of rutas) {
    let mejorDeLaRuta: Candidata | null = null;

    for (let i = 0; i < ruta.variants.length; i++) {
      const trazo = ruta.geometrias[i] as Posicion[] | undefined;
      if (!trazo || trazo.length < 2) continue;

      const candidata: Candidata = {
        ruta,
        indiceVariante: i,
        origen: proyectarEnTrazo(origen, trazo),
        destino: proyectarEnTrazo(destino, trazo),
      };

      if (candidata.origen.distanciaM > maxCaminata) continue;
      if (candidata.destino.distanciaM > maxCaminata) continue;
      if (aBordoDe(candidata) < MINIMO_A_BORDO_M) continue;

      if (!mejorDeLaRuta || caminataDe(candidata) < caminataDe(mejorDeLaRuta)) {
        mejorDeLaRuta = candidata;
      }
    }

    if (mejorDeLaRuta) candidatas.push(mejorDeLaRuta);
  }

  // Primero la que menos te hace caminar; a igual caminata, la que menos te
  // tiene arriba del camión.
  candidatas.sort((a, b) => caminataDe(a) - caminataDe(b) || aBordoDe(a) - aBordoDe(b));

  return {
    options: candidatas.slice(0, 3).map(armarOpcion),
    meta: { maxWalkM: maxCaminata, generatedAt: new Date().toISOString() },
  };
}
