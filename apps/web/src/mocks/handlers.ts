import { delay, http, HttpResponse } from "msw";

import {
  buscarRutas,
  concesionarias,
  geojsonDeRuta,
  paradasEn,
  planearViaje,
  rutaPorSlug,
  rutasCercanas,
} from "@/datos/consultas";
import { API_BASE } from "@/lib/env";

import { escenarioActual, retrasoMs } from "./scenarios";

/**
 * Handlers de MSW para el contrato de API v1.
 *
 * **Son envoltorios, no una segunda implementación.** Desde el bloque 7 la
 * lógica vive en `@/datos/consultas` y la usan los dos: estos handlers y los
 * Route Handlers que sirven la API de verdad. Tenerla escrita dos veces es
 * cómo se consigue que la aplicación se comporte distinto en desarrollo y en
 * producción, y que una prueba en verde no signifique nada.
 *
 * Lo único que estos agregan es lo que el servidor real no debe tener: los
 * escenarios de falla (`?simular=vacio|error|lento`), para poder construir y
 * *ver* los tres estados obligatorios.
 *
 * Las calificaciones **no están aquí a propósito**: viven en Postgres y las
 * sirve su Route Handler. Una petición a `/ratings` pasa de largo y llega al
 * servidor de verdad, también en desarrollo.
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

const vacio = () => escenarioActual() === "vacio";

export const handlers = [
  // ---------------------------------------------------------------- catálogo
  http.get(u("/routes"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const p = new URL(request.url).searchParams;
    const resultado = buscarRutas({
      q: p.get("q"),
      agency: p.get("agency"),
      page: Number(p.get("page") ?? 1),
      limit: Number(p.get("limit") ?? 0) || undefined,
    });

    if (vacio()) return HttpResponse.json({ ...resultado, items: [], total: 0, totalPages: 1 });
    return HttpResponse.json(resultado);
  }),

  http.get(u("/routes/:slug"), async ({ params }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const slug = String(params["slug"]);
    const ruta = rutaPorSlug(slug);
    if (!ruta) {
      return problem(404, "Esa ruta no existe", `No hay ninguna ruta con el identificador ${slug}`);
    }
    return HttpResponse.json(ruta);
  }),

  http.get(u("/routes/:slug/geojson"), async ({ params }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const geojson = geojsonDeRuta(String(params["slug"]));
    if (!geojson) return problem(404, "Esa ruta no existe");
    return HttpResponse.json(geojson);
  }),

  http.get(u("/agencies"), async () => {
    const fallo = await compuerta();
    if (fallo) return fallo;
    return HttpResponse.json(vacio() ? [] : concesionarias());
  }),

  http.get(u("/stops"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;
    if (vacio()) return HttpResponse.json([]);
    return HttpResponse.json(paradasEn(new URL(request.url).searchParams.get("bbox")));
  }),

  // ------------------------------------------------------------------ cercanas
  http.get(u("/nearby"), async ({ request }) => {
    const fallo = await compuerta();
    if (fallo) return fallo;

    const p = new URL(request.url).searchParams;
    const lat = Number(p.get("lat"));
    const lng = Number(p.get("lng"));
    const radio = Number(p.get("radius") ?? 0) || undefined;
    const limite = Number(p.get("limit") ?? 0) || undefined;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return problem(422, "Faltan las coordenadas", "lat y lng son obligatorios y numéricos");
    }
    if (vacio()) return HttpResponse.json({ routes: [], radiusM: radio ?? 500 });

    return HttpResponse.json(
      rutasCercanas({
        lat,
        lng,
        ...(radio ? { radius: radio } : {}),
        ...(limite ? { limit: limite } : {}),
      }),
    );
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
    if (!cuerpo.origin || !cuerpo.destination) return problem(422, "Faltan origen o destino");

    const plan = planearViaje({
      origin: cuerpo.origin,
      destination: cuerpo.destination,
      ...(cuerpo.maxWalkM ? { maxWalkM: cuerpo.maxWalkM } : {}),
    });

    if (vacio()) return HttpResponse.json({ ...plan, options: [] });
    return HttpResponse.json(plan);
  }),
];
