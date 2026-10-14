import {
  NEARBY_DEFAULT_LIMIT,
  NEARBY_DEFAULT_RADIUS_M,
  PAGE_DEFAULT_LIMIT,
  type Agency,
  type NearbyResponse,
  type RouteDetail,
  type RouteSummary,
  type Stop,
} from "@combiaje/shared";

import { CONCESIONARIAS_ACTIVAS, PARADAS, RUTAS, RUTAS_RESUMEN } from "./dataset";
import { distanciaATrazo, recuadroDe, type Posicion } from "./geo";

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

export interface ConsultaViaje {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  maxWalkM?: number;
}

/**
 * `POST /trip-plan`, solo viajes directos.
 *
 * Una ruta sirve si pasa cerca del origen **y** del destino. Falta validar que
 * los toque en ese orden —hoy puede proponer una ruta que pasa por el destino
 * antes que por el origen—; eso necesita proyectar los dos puntos sobre el
 * trazo y comparar sus posiciones, y es parte del hito S5. Hasta entonces, la
 * pantalla `/planear` sigue sin publicarse.
 */
export function planearViaje(consulta: ConsultaViaje) {
  const maxCaminata = consulta.maxWalkM ?? 800;

  const options = RUTAS.map((ruta) => {
    const trazo = ruta.geometrias[0] as Posicion[];
    return {
      ruta,
      aOrigen: distanciaATrazo([consulta.origin.lng, consulta.origin.lat], trazo),
      aDestino: distanciaATrazo([consulta.destination.lng, consulta.destination.lat], trazo),
    };
  })
    .filter((c) => c.aOrigen <= maxCaminata && c.aDestino <= maxCaminata)
    .sort((a, b) => a.aOrigen + a.aDestino - (b.aOrigen + b.aDestino))
    .slice(0, 3)
    .map(({ ruta, aOrigen, aDestino }) => ({
      type: "direct" as const,
      totalWalkM: Math.round(aOrigen + aDestino),
      legs: [
        { mode: "walk" as const, distanceM: Math.round(aOrigen) },
        {
          mode: "bus" as const,
          routeId: ruta.id,
          routeShortName: ruta.shortName,
          color: ruta.color,
          variantId: ruta.variants[0]!.id,
          boardAt: {
            lat: consulta.origin.lat,
            lng: consulta.origin.lng,
            name: "Parada más cercana al origen",
          },
          alightAt: {
            lat: consulta.destination.lat,
            lng: consulta.destination.lng,
            name: "Parada más cercana al destino",
          },
          onboardDistanceM: Math.round(ruta.variants[0]!.lengthM * 0.4),
        },
        { mode: "walk" as const, distanceM: Math.round(aDestino) },
      ],
    }));

  return { options, meta: { maxWalkM: maxCaminata, generatedAt: new Date().toISOString() } };
}
