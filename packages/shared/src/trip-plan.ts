import { z } from "zod";

import {
  coordinatesSchema,
  hexColorSchema,
  namedPlaceSchema,
  slugSchema,
  uuidSchema,
} from "./primitives";

/**
 * `POST /trip-plan`. Esta es la única respuesta cuya forma viene escrita
 * literalmente en el plan maestro, así que se transcribe tal cual.
 *
 * Con un añadido: `routeSlug`. El plan traía `routeId`, y con solo el UUID el
 * mapa no puede dibujar nada —todo lo demás de la API se dirige por slug,
 * `/routes/:slug/geojson` incluido—, así que la pantalla tendría que cruzar el
 * plan contra el catálogo completo para traducir id → slug. Devolverlo es una
 * cadena por tramo y le ahorra al cliente una petición y un join.
 */

export const walkLegSchema = z.object({
  mode: z.literal("walk"),
  distanceM: z.number().nonnegative(),
  toStopId: uuidSchema.optional(),
});

export const busLegSchema = z.object({
  mode: z.literal("bus"),
  routeId: uuidSchema,
  routeSlug: slugSchema,
  routeShortName: z.string(),
  color: hexColorSchema,
  /** La variante que **sí** te lleva: ida o vuelta, no las dos. */
  variantId: uuidSchema,
  variantName: z.string(),
  boardAt: namedPlaceSchema,
  alightAt: namedPlaceSchema,
  onboardDistanceM: z.number().nonnegative(),
});

export const tripLegSchema = z.discriminatedUnion("mode", [walkLegSchema, busLegSchema]);

export const tripOptionSchema = z.object({
  type: z.enum(["direct", "transfer"]),
  totalWalkM: z.number().nonnegative(),
  legs: z.array(tripLegSchema).min(1),
});

export const tripPlanResponseSchema = z.object({
  options: z.array(tripOptionSchema),
  meta: z.object({
    maxWalkM: z.number().positive(),
    generatedAt: z.iso.datetime(),
  }),
});

export const tripPlanRequestSchema = z.object({
  origin: coordinatesSchema,
  destination: coordinatesSchema,
  maxWalkM: z.number().positive().max(2000).default(800),
  maxTransfers: z.number().int().min(0).max(2).default(1),
});

export type WalkLeg = z.infer<typeof walkLegSchema>;
export type BusLeg = z.infer<typeof busLegSchema>;
export type TripLeg = z.infer<typeof tripLegSchema>;
export type TripOption = z.infer<typeof tripOptionSchema>;
export type TripPlanResponse = z.infer<typeof tripPlanResponseSchema>;
export type TripPlanRequest = z.input<typeof tripPlanRequestSchema>;
