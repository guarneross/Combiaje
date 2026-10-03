import { z } from "zod";

/**
 * Piezas que se repiten en todo el contrato v1.
 *
 * ⚠️ BORRADOR — propuesto por Frontend, pendiente de aprobación de
 * Arquitectura. Ver `docs/frontend/04-contrato.md`.
 */

export const uuidSchema = z.uuid();

/** Slug de URL: minúsculas, números y guiones. "ruta-72-centro-la-margarita" */
export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido");

/** Color en hexadecimal de 7 caracteres, como lo guarda la base. "#E11D48" */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "El color debe venir como #RRGGBB");

/**
 * Un punto. El contrato usa `lat`/`lng` sueltos (ver el ejemplo de
 * /trip-plan), no GeoJSON, porque así se consume directo en MapLibre.
 */
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Un punto con nombre: paradas de ascenso y descenso. */
export const namedPlaceSchema = coordinatesSchema.extend({
  name: z.string(),
});

/**
 * Recuadro geográfico para los parámetros `bbox`.
 * Orden [oeste, sur, este, norte], el mismo de MapLibre y de GeoJSON.
 */
export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/**
 * Envoltura de paginación.
 *
 * ⚠️ El contrato define los parámetros de entrada (`page`, `limit`) pero no la
 * forma de la respuesta. Esta es la propuesta: `items` más los datos mínimos
 * para pintar un paginador sin tener que adivinar.
 */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });
}

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * Error según RFC 7807 (`application/problem+json`), como manda el plan
 * maestro. Todo error de la API llega con esta forma.
 */
export const problemSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Errores de validación campo por campo, cuando el status es 422. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type Coordinates = z.infer<typeof coordinatesSchema>;
export type NamedPlace = z.infer<typeof namedPlaceSchema>;
export type Bbox = z.infer<typeof bboxSchema>;
export type Problem = z.infer<typeof problemSchema>;
