import { z } from "zod";

import { coordinatesSchema, uuidSchema } from "./primitives";

/**
 * En el transporte concesionado de Puebla casi no hay paradas formales: la
 * gente levanta la mano. Por eso `informal` es el valor por omisión y no una
 * excepción.
 */
export const stopKindSchema = z.enum(["formal", "informal", "terminal"]);

export const stopSchema = coordinatesSchema.extend({
  id: uuidSchema,
  name: z.string(),
  kind: stopKindSchema,
});

export type StopKind = z.infer<typeof stopKindSchema>;
export type Stop = z.infer<typeof stopSchema>;

export const STOP_KIND_LABEL: Record<StopKind, string> = {
  formal: "Parada con señalamiento",
  informal: "Parada de referencia",
  terminal: "Terminal",
};
