import { z } from "zod";

import { hexColorSchema, uuidSchema } from "./primitives";

/**
 * `GET /routes/:slug/geojson`.
 *
 * Esto NO es la fuente del mapa: las rutas se pintan desde teselas
 * vectoriales. El GeoJSON se usa para dos cosas y nada más:
 *   1. superponer una ruta concreta con más detalle del que trae la tesela;
 *   2. calcular el encuadre con `fitBounds`.
 *
 * Validación a propósito laxa en las coordenadas: una LineString de una ruta
 * trae cientos de pares, y correr Zod sobre cada número en un teléfono de
 * gama media cuesta más de lo que vale.
 */

const positionSchema = z.array(z.number()).min(2);

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(positionSchema),
});

export const routeGeoJsonFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: lineStringSchema,
  properties: z.object({
    variantId: uuidSchema,
    routeId: uuidSchema,
    name: z.string(),
    direction: z.union([z.literal(0), z.literal(1)]),
    color: hexColorSchema,
    isPrimary: z.boolean(),
  }),
});

export const routeGeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(routeGeoJsonFeatureSchema),
  /** [oeste, sur, este, norte] — para fitBounds sin recorrer las coordenadas. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export type RouteGeoJsonFeature = z.infer<typeof routeGeoJsonFeatureSchema>;
export type RouteGeoJson = z.infer<typeof routeGeoJsonSchema>;
