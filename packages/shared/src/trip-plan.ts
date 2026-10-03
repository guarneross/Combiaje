import { z } from "zod";

import { coordinatesSchema, hexColorSchema, namedPlaceSchema, uuidSchema } from "./primitives";

/**
 * `POST /trip-plan`. Esta es la única respuesta cuya forma viene escrita
 * literalmente en el plan maestro, así que se transcribe tal cual.
 */

export const walkLegSchema = z.object({
  mode: z.literal("walk"),
  distanceM: z.number().nonnegative(),
  toStopId: uuidSchema.optional(),
});

export const busLegSchema = z.object({
  mode: z.literal("bus"),
  routeId: uuidSchema,
  routeShortName: z.string(),
  color: hexColorSchema,
  variantId: uuidSchema,
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
