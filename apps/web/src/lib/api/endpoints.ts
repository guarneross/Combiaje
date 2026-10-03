import {
  agencySchema,
  nearbyResponseSchema,
  paginatedSchema,
  routeDetailSchema,
  routeGeoJsonSchema,
  routeSummarySchema,
  stopSchema,
  tripPlanResponseSchema,
  type Bbox,
  type TripPlanRequest,
} from "@combiaje/shared";
import { z } from "zod";

import { api, type OpcionesPeticion } from "./client";

/**
 * Una función por endpoint del contrato v1. Transporte puro: ni caché ni
 * estados de carga. Eso vive en `queries.ts`.
 *
 * Si un endpoint no está aquí, es porque no está en el contrato. No se agrega
 * sin pasar por Arquitectura.
 */

const bboxAParametro = (bbox: Bbox) => bbox.join(",");

export interface FiltrosRutas {
  q?: string;
  agency?: string;
  bbox?: Bbox;
  page?: number;
  limit?: number;
}

/** `GET /routes` */
export function obtenerRutas(filtros: FiltrosRutas = {}, opciones?: OpcionesPeticion) {
  return api.get("/routes", paginatedSchema(routeSummarySchema), {
    ...opciones,
    params: {
      q: filtros.q,
      agency: filtros.agency,
      bbox: filtros.bbox ? bboxAParametro(filtros.bbox) : undefined,
      page: filtros.page,
      limit: filtros.limit,
    },
  });
}

/** `GET /routes/:slug` */
export function obtenerRuta(slug: string, opciones?: OpcionesPeticion) {
  return api.get(`/routes/${encodeURIComponent(slug)}`, routeDetailSchema, opciones);
}

/** `GET /routes/:slug/geojson` — solo para resaltar o encuadrar, nunca para el mapa completo. */
export function obtenerRutaGeoJson(slug: string, opciones?: OpcionesPeticion) {
  return api.get(`/routes/${encodeURIComponent(slug)}/geojson`, routeGeoJsonSchema, opciones);
}

/** `GET /agencies` */
export function obtenerConcesionarias(opciones?: OpcionesPeticion) {
  return api.get("/agencies", z.array(agencySchema), opciones);
}

/** `GET /stops?bbox=` */
export function obtenerParadas(bbox: Bbox, opciones?: OpcionesPeticion) {
  return api.get("/stops", z.array(stopSchema), {
    ...opciones,
    params: { bbox: bboxAParametro(bbox) },
  });
}

/**
 * `GET /nearby`
 *
 * La ubicación del usuario se manda para responder y **no se persiste ni se
 * registra en log**, según el compromiso de privacidad del plan maestro (§13).
 */
export function obtenerRutasCercanas(
  args: { lat: number; lng: number; radius?: number; limit?: number },
  opciones?: OpcionesPeticion,
) {
  return api.get("/nearby", nearbyResponseSchema, {
    ...opciones,
    params: {
      lat: args.lat,
      lng: args.lng,
      radius: args.radius,
      limit: args.limit,
    },
  });
}

/** `POST /trip-plan` */
export function planearViaje(cuerpo: TripPlanRequest, opciones?: OpcionesPeticion) {
  return api.post("/trip-plan", tripPlanResponseSchema, cuerpo, opciones);
}
