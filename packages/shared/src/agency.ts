import { z } from "zod";

import { uuidSchema } from "./primitives";

/** Tipo de servicio que presta la concesionaria u organismo. */
export const agencyTypeSchema = z.enum(["brt", "urbano", "suburbano", "colectivo"]);

export const agencySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  shortName: z.string().nullable(),
  type: agencyTypeSchema,
});

export type AgencyType = z.infer<typeof agencyTypeSchema>;
export type Agency = z.infer<typeof agencySchema>;

/** Etiquetas de interfaz, en español de México. */
export const AGENCY_TYPE_LABEL: Record<AgencyType, string> = {
  brt: "RUTA / BRT",
  urbano: "Urbano",
  suburbano: "Suburbano",
  colectivo: "Colectivo",
};
