import { z } from "zod";

import { uuidSchema } from "./primitives";

/**
 * Calificaciones de la comunidad.
 *
 * El formulario mínimo es **una sola cosa**: las estrellas. Todo lo demás es
 * opcional. Quien está parado en la esquina con prisa no llena cinco
 * controles, y cinco controles obligatorios se traducen en cero
 * calificaciones. Ver `02-modelo-de-rutas-y-calificaciones.md` §4.
 */

/** Una puntuación de estrellas: entero de 1 a 5. */
export const starsSchema = z.number().int().min(1).max(5);

export const COMMENT_MAX = 500;
export const VEHICLE_NUMBER_MAX = 16;

/**
 * Cuerpo de `POST /routes/:slug/ratings`.
 *
 * Solo `overall` es obligatorio. Las cadenas vacías se tratan como ausencia:
 * un campo de texto que el usuario abrió y dejó en blanco no es un comentario
 * vacío, es que no comentó.
 */
export const ratingCreateSchema = z.object({
  overall: starsSchema,

  safety: starsSchema.nullish(),
  cleanliness: starsSchema.nullish(),
  driver: starsSchema.nullish(),
  driving: starsSchema.nullish(),
  frequency: starsSchema.nullish(),

  /** Número económico de la unidad, como viene pintado. */
  vehicleNumber: z
    .string()
    .trim()
    .max(VEHICLE_NUMBER_MAX)
    .nullish()
    .transform((v) => (v ? v : null)),

  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type RatingCreate = z.input<typeof ratingCreateSchema>;

/**
 * Una calificación tal como se devuelve.
 *
 * ⚠️ **Sin identidad de quien calificó.** No hay nombre ni avatar, y el
 * `userId` no sale de la API. Con sesiones anónimas no habría nada que
 * enseñar, y publicar el identificador permitiría cruzar «quién calificó qué»
 * ruta por ruta — es decir, por dónde se mueve una persona. Lo único que la
 * API dice de la autoría es `esMia`, y solo a su propio autor.
 */
export const ratingSchema = z.object({
  id: uuidSchema,
  routeSlug: z.string(),
  overall: starsSchema,
  safety: starsSchema.nullable(),
  cleanliness: starsSchema.nullable(),
  driver: starsSchema.nullable(),
  driving: starsSchema.nullable(),
  frequency: starsSchema.nullable(),
  vehicleNumber: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** `true` solo en la calificación de quien hace la petición. */
  esMia: z.boolean().default(false),
});

export type Rating = z.infer<typeof ratingSchema>;

/** Orden de `GET /routes/:slug/ratings`. */
export const ratingSortSchema = z.enum(["recientes", "mejores", "peores"]).default("recientes");
export type RatingSort = z.infer<typeof ratingSortSchema>;
