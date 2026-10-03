import { NEARBY_DEFAULT_LIMIT, NEARBY_DEFAULT_RADIUS_M, PAGE_DEFAULT_LIMIT } from "@combiaje/shared";
import { delay, http, HttpResponse } from "msw";

import { API_BASE } from "@/lib/env";

import { CONCESIONARIAS, PARADAS, RUTAS, RUTAS_RESUMEN } from "./data/puebla";
import { distanciaATrazo, recuadroDe, type Posicion } from "./geo";
import { escenarioActual, retrasoMs } from "./scenarios";

/**
 * Handlers de MSW para el contrato de API v1.
 *
 * Solo endpoints que existen en el contrato. Si falta uno aquí es porque no
 * está en el contrato, y agregarlo requiere pasar por Arquitectura.
 */

const u = (ruta: string) => `${API_BASE}${ruta}`;

/** Error con la forma RFC 7807 que manda el plan maestro. */
function problem(status: number, title: string, detail?: string) {
  return HttpResponse.json(
    { type: "about:blank", title, status, ...(detail ? { detail } : {}) },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Puerta común: aplica retraso y, en el escenario "error", tumba la petición. */
async function compuerta(): Promise<Response | null> {
  await delay(retrasoMs());
  if (escenarioActual() === "error") {
    return problem(503, "Servicio no disponible", "Escenario de prueba: ?simular=error");
  }
  return null;
}

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const handlers = [
  // ---------------------------------------------------------------- catálogo
  http.get(u("/routes"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const params = new URL(request.url).searchParams;
    const q = params.get("q");
    const agency = params.get("agency");
    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? PAGE_DEFAULT_LIMIT);

    let encontradas = escenarioActual() === "vacio" ? [] : RUTAS_RESUMEN;

    if (q) {
      const aguja = normalizar(q);
      encontradas = encontradas.filter(
        (r) =>
          normalizar(r.shortName).includes(aguja) ||
          normalizar(r.longName).includes(aguja) ||
          normalizar(r.agency?.shortName ?? "").includes(aguja),
      );
    }
    if (agency) {
      encontradas = encontradas.filter((r) => r.agency?.id === agency || r.agency?.shortName === agency);
    }

    const total = encontradas.length;
    const desde = (page - 1) * limit;

    return HttpResponse.json({
      items: encontradas.slice(desde, desde + limit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),

  http.get(u("/routes/:slug"), async ({ params }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const ruta = RUTAS.find((r) => r.slug === params["slug"]);
    if (!ruta) return problem(404, "Esa ruta no existe", `No hay ninguna ruta con el identificador ${String(params["slug"])}`);

    const { geometrias: _geometrias, ...detalle } = ruta;
    return HttpResponse.json(detalle);
  }),

  http.get(u("/routes/:slug/geojson"), async ({ params }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const ruta = RUTAS.find((r) => r.slug === params["slug"]);
    if (!ruta) return problem(404, "Esa ruta no existe");

    return HttpResponse.json({
      type: "FeatureCollection",
      bbox: recuadroDe(ruta.geometrias as Posicion[][]),
      features: ruta.variants.map((variante, i) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: ruta.geometrias[i] },
        properties: {
          variantId: variante.id,
          routeId: ruta.id,
          name: variante.name,
          direction: variante.direction,
          color: ruta.color,
          isPrimary: variante.isPrimary,
        },
      })),
    });
  }),

  http.get(u("/agencies"), async () => {
    const fallo = await compuerta();
    if (fallo) return fallo;
    return HttpResponse.json(escenarioActual() === "vacio" ? [] : CONCESIONARIAS);
  }),

  http.get(u("/stops"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const bbox = new URL(request.url).searchParams.get("bbox");
    if (escenarioActual() === "vacio") return HttpResponse.json([]);
    if (!bbox) return HttpResponse.json(PARADAS);

    const [oeste, sur, este, norte] = bbox.split(",").map(Number) as [number, number, number, number];
    return HttpResponse.json(
      PARADAS.filter((p) => p.lng >= oeste && p.lng <= este && p.lat >= sur && p.lat <= norte),
    );
  }),

  // ------------------------------------------------------------------ cercanas
  http.get(u("/nearby"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const radio = Number(params.get("radius") ?? NEARBY_DEFAULT_RADIUS_M);
    const limite = Number(params.get("limit") ?? NEARBY_DEFAULT_LIMIT);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return problem(422, "Faltan las coordenadas", "lat y lng son obligatorios y deben ser números");
    }
    if (escenarioActual() === "vacio") {
      return HttpResponse.json({ routes: [], radiusM: radio });
    }

    const punto: Posicion = [lng, lat];
    const cercanas = RUTAS.map((ruta) => ({
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

    return HttpResponse.json({ routes: cercanas, radiusM: radio });
  }),

  // --------------------------------------------------------------- planificador
  http.post(u("/trip-plan"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const cuerpo = (await request.json()) as {
      origin?: { lat: number; lng: number };
      destination?: { lat: number; lng: number };
      maxWalkM?: number;
    };
    const origen = cuerpo.origin;
    const destino = cuerpo.destination;
    if (!origen || !destino) return problem(422, "Faltan origen o destino");

    const maxCaminata = cuerpo.maxWalkM ?? 800;
    if (escenarioActual() === "vacio") {
      return HttpResponse.json({
        options: [],
        meta: { maxWalkM: maxCaminata, generatedAt: new Date().toISOString() },
      });
    }

    // Una ruta sirve si pasa cerca del origen y del destino. El sentido
    // (ST_LineLocatePoint) lo valida el backend real; aquí no hace falta.
    const opciones = RUTAS.map((ruta) => {
      const trazo = ruta.geometrias[0] as Posicion[];
      const aOrigen = distanciaATrazo([origen.lng, origen.lat], trazo);
      const aDestino = distanciaATrazo([destino.lng, destino.lat], trazo);
      return { ruta, aOrigen, aDestino };
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
            boardAt: { lat: origen.lat, lng: origen.lng, name: "Parada más cercana al origen" },
            alightAt: { lat: destino.lat, lng: destino.lng, name: "Parada más cercana al destino" },
            onboardDistanceM: Math.round(ruta.variants[0]!.lengthM * 0.4),
          },
          { mode: "walk" as const, distanceM: Math.round(aDestino) },
        ],
      }));

    return HttpResponse.json({
      options: opciones,
      meta: { maxWalkM: maxCaminata, generatedAt: new Date().toISOString() },
    });
  }),
];
