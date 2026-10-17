import { z } from "zod";

import { coordinatesSchema } from "./primitives";

/**
 * `GET /geocode?q=` — buscar un lugar al que ir.
 *
 * ⚠️ **No está en el contrato de API v1 del plan maestro.** El plan daba por
 * hecho que el destino se elige tocando el mapa; en la calle, la gente dice
 * «voy a la 25 Poniente» o «voy a San Ramón», no señala un punto. Sin esto,
 * la pregunta «¿a dónde quieres ir?» solo se puede contestar con las doce
 * terminales que conoce el dataset.
 *
 * La respuesta es deliberadamente pobre: nombre, contexto y coordenada. Ni
 * polígonos, ni códigos postales, ni el objeto de OpenStreetMap completo. Lo
 * único que hace falta para poner un alfiler y planear un viaje.
 */

export const placeKindSchema = z.enum([
  /** Una parada o terminal del propio dataset de Combiaje. */
  "stop",
  /** Colonia, barrio, fraccionamiento, junta auxiliar. */
  "neighborhood",
  /** Una calle o avenida. */
  "street",
  /** Hospital, escuela, mercado, plaza, parque… */
  "poi",
  /** Municipio o localidad. */
  "locality",
  "other",
]);

export const placeSchema = coordinatesSchema.extend({
  /**
   * Estable entre búsquedas iguales, para poder usarlo como `key` de React.
   * No es un UUID: los lugares de OpenStreetMap no son filas nuestras.
   */
  id: z.string().min(1),
  /** Lo que se lee en grande. «Zócalo», «25 Poniente». */
  name: z.string().min(1),
  /** Lo que distingue dos homónimos. «Centro · Puebla». `null` si no aporta. */
  context: z.string().nullable(),
  kind: placeKindSchema,
  /**
   * De dónde salió. `combiaje` son nuestras paradas y van primero: las
   * conocemos, tienen rutas encima y no dependen de que nadie responda.
   */
  source: z.enum(["combiaje", "osm"]),
});

export const geocodeResponseSchema = z.object({
  results: z.array(placeSchema),
  /**
   * `true` cuando el buscador externo no contestó y solo van los lugares
   * propios. La pantalla lo dice en vez de fingir que no hay nada más.
   */
  partial: z.boolean(),
  /** Atribución obligatoria de los datos de OpenStreetMap (ODbL). */
  attribution: z.string(),
});

export type PlaceKind = z.infer<typeof placeKindSchema>;
export type Place = z.infer<typeof placeSchema>;
export type GeocodeResponse = z.infer<typeof geocodeResponseSchema>;

/** Mínimo de letras para buscar. Con menos, media ciudad coincide. */
export const GEOCODE_MIN_LENGTH = 3;
export const GEOCODE_DEFAULT_LIMIT = 8;
export const GEOCODE_MAX_LIMIT = 15;

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  stop: "Parada",
  neighborhood: "Colonia",
  street: "Calle",
  poi: "Lugar",
  locality: "Localidad",
  other: "Lugar",
};
