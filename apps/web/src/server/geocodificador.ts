import {
  GEOCODE_DEFAULT_LIMIT,
  type GeocodeResponse,
  type Place,
  type PlaceKind,
} from "@combiaje/shared";

import { lugaresPropios } from "@/datos/consultas";
import { MAP_ATTRIBUTION, PUEBLA_BBOX, PUEBLA_CENTER } from "@/lib/constants";

/**
 * Buscar un lugar al que ir.
 *
 * Dos fuentes, en este orden:
 *
 * 1. **Las paradas de Combiaje.** Son las que tienen rutas encima y no
 *    dependen de nadie.
 * 2. **Photon**, el buscador de komoot sobre datos de OpenStreetMap. Es el que
 *    sabe de calles y colonias.
 *
 * ### Por qué pasa por nuestro servidor y no por el navegador
 *
 * Llamar a Photon desde el navegador mandaría **lo que cada persona teclea,
 * junto con su IP**, a un tercero, letra por letra. Pasando por aquí, komoot
 * ve nuestro servidor y no a quien busca. Además: se puede guardar en caché
 * (la misma colonia la buscan muchos), se puede poner un límite para no
 * abusar de un servicio gratuito, y cambiar de proveedor toca este archivo y
 * nada más.
 *
 * **Lo que se busca no se registra en ningún log.** Un registro de búsquedas
 * es un registro de a dónde va la gente, que es exactamente el dato que el
 * plan maestro promete no guardar.
 *
 * ### Qué pasa si Photon no contesta
 *
 * Se devuelven los lugares propios con `partial: true` y la pantalla lo dice.
 * Nunca un 500: que un buscador ajeno se caiga no puede tumbar la pregunta
 * principal de la aplicación.
 *
 * Photon es un servicio gratuito sin garantía; el plan es sustituirlo por un
 * índice propio del área metropolitana, generado de OpenStreetMap al compilar.
 * Ese día cambia solo este archivo.
 */

/**
 * El buscador externo.
 *
 * Se puede cambiar con `PHOTON_URL` sin tocar código: para apuntar a una
 * instancia propia de Photon el día que convenga, o a un doble local mientras
 * se prueba. **No** lleva `NEXT_PUBLIC_`: esta URL es del servidor y el
 * navegador no tiene por qué conocerla.
 */
const PHOTON = process.env["PHOTON_URL"] || "https://photon.komoot.io/api/";

/** Cuatro segundos. Más que eso y quien escribe ya siguió escribiendo. */
const TIEMPO_LIMITE_MS = 4_000;

/** Nos identificamos: es lo mínimo que pide cualquier servicio de OSM. */
const AGENTE = "Combiaje/0.1 (+https://combiaje.joscian.com)";

const [OESTE, SUR, ESTE, NORTE] = PUEBLA_BBOX;

// --------------------------------------------------------------------- caché

interface Entrada {
  expira: number;
  lugares: Place[];
}

/**
 * Caché en memoria del proceso.
 *
 * No es Redis ni falta: en hosting compartido Passenger levanta y mata
 * procesos a su antojo, y lo peor que pasa si se pierde es una petición más a
 * Photon. Lo que sí evita es repetirle la misma colonia cien veces.
 */
const CACHE = new Map<string, Entrada>();
const CACHE_MAXIMO = 500;
const CACHE_VIDA_MS = 60 * 60_000;

function deCache(clave: string): Place[] | null {
  const entrada = CACHE.get(clave);
  if (!entrada) return null;
  if (entrada.expira < Date.now()) {
    CACHE.delete(clave);
    return null;
  }
  // Vuelve a insertarse para que el más usado sea el último: así el recorte
  // de abajo tira lo más viejo y no lo más popular.
  CACHE.delete(clave);
  CACHE.set(clave, entrada);
  return entrada.lugares;
}

function aCache(clave: string, lugares: Place[]): void {
  CACHE.set(clave, { expira: Date.now() + CACHE_VIDA_MS, lugares });
  while (CACHE.size > CACHE_MAXIMO) {
    const masViejo = CACHE.keys().next().value;
    if (masViejo === undefined) break;
    CACHE.delete(masViejo);
  }
}

// ------------------------------------------------------- traducir a lo nuestro

/**
 * Qué clase de lugar es, a partir de las etiquetas de OpenStreetMap.
 *
 * Sirve para dos cosas: decirlo en la lista y ordenar. Una colonia es mejor
 * destino que un cajero automático con el mismo nombre.
 */
function claseDe(llave: unknown, valor: unknown): PlaceKind {
  if (llave === "highway") return "street";
  if (llave === "place") {
    if (valor === "city" || valor === "town" || valor === "village") return "locality";
    return "neighborhood";
  }
  if (llave === "boundary") return "locality";
  if (
    llave === "amenity" ||
    llave === "shop" ||
    llave === "tourism" ||
    llave === "leisure" ||
    llave === "healthcare" ||
    llave === "public_transport" ||
    llave === "railway" ||
    llave === "building"
  ) {
    return "poi";
  }
  return "other";
}

/** Primero lo que de verdad sirve de destino. */
const ORDEN: Record<PlaceKind, number> = {
  stop: 0,
  neighborhood: 1,
  street: 2,
  poi: 3,
  locality: 4,
  other: 5,
};

const texto = (valor: unknown): string | null =>
  typeof valor === "string" && valor.trim() ? valor.trim() : null;

/**
 * Traduce la respuesta de Photon a lugares nuestros.
 *
 * Exportada para poder probarla sin red: es donde está todo lo que puede
 * salir mal —un rasgo sin nombre, una coordenada fuera de Puebla, un
 * duplicado— y nada de eso debería necesitar internet para comprobarse.
 */
export function interpretarPhoton(cuerpo: unknown): Place[] {
  const rasgos = (cuerpo as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(rasgos)) return [];

  const lugares: Place[] = [];
  const vistos = new Set<string>();

  for (const rasgo of rasgos) {
    const r = rasgo as {
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: unknown };
    };
    const p = r.properties ?? {};
    const coords = r.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    // Fuera del área metropolitana no nos sirve: no hay rutas allá, y un
    // «Centro» de Veracruz entre los resultados es ruido. Se filtra aquí
    // además de pedírselo a Photon, porque el filtro propio sí lo controlamos.
    if (lng < OESTE || lng > ESTE || lat < SUR || lat > NORTE) continue;

    // Una calle sin nombre no se puede ofrecer como destino.
    const calle = texto(p["street"]);
    const numero = texto(p["housenumber"]);
    const nombre =
      texto(p["name"]) ?? (calle ? [calle, numero].filter(Boolean).join(" ") : null);
    if (!nombre) continue;

    const partes = [texto(p["district"]), texto(p["city"]), texto(p["state"])]
      // Sin repetir: en Puebla capital, `city` y `state` son la misma palabra.
      .filter((v, i, todas): v is string => Boolean(v) && todas.indexOf(v) === i)
      .filter((v) => v !== nombre);

    const clase = claseDe(p["osm_key"], p["osm_value"]);
    const tipo = texto(p["osm_type"]) ?? "x";
    const id = `osm:${tipo}${p["osm_id"] ?? `${lng},${lat}`}`;

    // Photon devuelve el mismo lugar varias veces cuando está cartografiado
    // como punto y como polígono.
    const huella = `${nombre}|${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (vistos.has(huella)) continue;
    vistos.add(huella);

    lugares.push({
      id,
      name: nombre,
      context: partes.length > 0 ? partes.join(" · ") : null,
      lat,
      lng,
      kind: clase,
      source: "osm",
    });
  }

  return lugares.sort((a, b) => ORDEN[a.kind] - ORDEN[b.kind]);
}

// ------------------------------------------------------------------ la consulta

async function preguntarAPhoton(q: string, limite: number): Promise<Place[]> {
  const url = new URL(PHOTON);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limite));
  // Sesgo hacia Puebla por si el recuadro no se respeta, y recuadro para que
  // no haya que traer media república y tirarla aquí.
  url.searchParams.set("lat", String(PUEBLA_CENTER.lat));
  url.searchParams.set("lon", String(PUEBLA_CENTER.lng));
  url.searchParams.set("bbox", `${OESTE},${SUR},${ESTE},${NORTE}`);

  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE, Accept: "application/json" },
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    // La caché la llevamos nosotros, arriba.
    cache: "no-store",
  });

  if (!respuesta.ok) throw new Error(`Photon respondió ${respuesta.status}`);
  return interpretarPhoton(await respuesta.json());
}

export interface ConsultaLugares {
  q: string;
  limit?: number;
}

export async function buscarLugares({
  q,
  limit = GEOCODE_DEFAULT_LIMIT,
}: ConsultaLugares): Promise<GeocodeResponse> {
  const consulta = q.trim();
  const propios = lugaresPropios(consulta, 4);
  const faltan = Math.max(limit - propios.length, 0);

  const respuesta = (lugares: Place[], partial: boolean): GeocodeResponse => ({
    results: [...propios, ...lugares].slice(0, limit),
    partial,
    attribution: MAP_ATTRIBUTION,
  });

  if (faltan === 0) return respuesta([], false);

  const clave = `${consulta.toLowerCase()}|${faltan}`;
  const enCache = deCache(clave);
  if (enCache) return respuesta(enCache, false);

  try {
    const lugares = await preguntarAPhoton(consulta, faltan);
    aCache(clave, lugares);
    return respuesta(lugares, false);
  } catch (error) {
    // A propósito: ni la consulta ni nada que la identifique. Solo que falló.
    console.warn(
      "[combiaje] el geocodificador externo no contestó:",
      error instanceof Error ? error.message : "error desconocido",
    );
    return respuesta([], true);
  }
}
