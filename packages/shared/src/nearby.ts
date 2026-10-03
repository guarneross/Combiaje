import { z } from "zod";

import { hexColorSchema, slugSchema, uuidSchema } from "./primitives";

/**
 * Un elemento de `GET /nearby`: una ruta que pasa cerca, con la distancia
 * real al trazo en metros.
 *
 * ⚠️ El SQL del plan maestro (§7.1) no selecciona `slug`, pero el frontend lo
 * necesita para enlazar a la ficha sin hacer una segunda petición por cada
 * resultado. Pedido a Arquitectura.
 */
export const nearbyRouteSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  shortName: z.string(),
  longName: z.string(),
  color: hexColorSchema,
  /** Distancia del usuario al trazo, en metros. */
  distanceM: z.number().nonnegative(),
});

export const nearbyResponseSchema = z.object({
  routes: z.array(nearbyRouteSchema),
  /** Radio que realmente se usó, por si el backend lo acota. */
  radiusM: z.number().positive(),
});

export type NearbyRoute = z.infer<typeof nearbyRouteSchema>;
export type NearbyResponse = z.infer<typeof nearbyResponseSchema>;
