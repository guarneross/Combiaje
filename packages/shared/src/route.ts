import { z } from "zod";

import { agencySchema } from "./agency";
import { hexColorSchema, slugSchema, uuidSchema } from "./primitives";

export const routeStatusSchema = z.enum(["draft", "published", "archived"]);
export const dataSourceSchema = z.enum(["osm", "manual", "gps", "official"]);

/**
 * Lo que devuelve `GET /routes` por cada elemento, y lo mínimo para pintar una
 * tarjeta de ruta en cualquier lista.
 *
 * ⚠️ `agency` embebida es propuesta de Frontend: sin ella, pintar el catálogo
 * obliga a cruzar cada ruta contra `GET /agencies` en el cliente. Si
 * Arquitectura prefiere solo `agencyId`, se quita y el frontend cachea el
 * catálogo de concesionarias aparte.
 */
export const routeSummarySchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  shortName: z.string(),
  longName: z.string(),
  color: hexColorSchema,
  textColor: hexColorSchema,
  fareCents: z.number().int().nonnegative().nullable(),
  status: routeStatusSchema,
  agency: agencySchema.nullable(),
});

/** Sentido de circulación: ida, vuelta o ramal. */
export const routeVariantSchema = z.object({
  id: uuidSchema,
  routeId: uuidSchema,
  name: z.string(),
  direction: z.union([z.literal(0), z.literal(1)]),
  lengthM: z.number().nonnegative(),
  isPrimary: z.boolean(),
});

/**
 * Calificación agregada por dimensión. `null` cuando todavía nadie califica:
 * un promedio de cero es mentira, la ausencia de datos no lo es.
 */
export const routeRatingStatsSchema = z.object({
  ratingsCount: z.number().int().nonnegative(),
  avgOverall: z.number().nullable(),
  avgSafety: z.number().nullable(),
  avgCleanliness: z.number().nullable(),
  avgDriver: z.number().nullable(),
  avgDriving: z.number().nullable(),
  avgFrequency: z.number().nullable(),
  /** Promedio bayesiano (C=20, m=3.5). Es el que sirve para ordenar. */
  bayesianScore: z.number().nullable(),
});

/** Lo que devuelve `GET /routes/:slug`. */
export const routeDetailSchema = routeSummarySchema.extend({
  dataSource: dataSourceSchema,
  variants: z.array(routeVariantSchema),
  ratingStats: routeRatingStatsSchema.nullable(),
  updatedAt: z.iso.datetime(),
});

export type RouteStatus = z.infer<typeof routeStatusSchema>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type RouteVariant = z.infer<typeof routeVariantSchema>;
export type RouteRatingStats = z.infer<typeof routeRatingStatsSchema>;
export type RouteDetail = z.infer<typeof routeDetailSchema>;

/**
 * Las cinco dimensiones que la comunidad califica. El orden importa: es el
 * que se usa en la ficha de ruta y en el formulario.
 */
export const RATING_DIMENSIONS = [
  { key: "safety", label: "Seguridad" },
  { key: "cleanliness", label: "Limpieza" },
  { key: "driver", label: "Trato del operador" },
  { key: "driving", label: "Forma de manejar" },
  { key: "frequency", label: "Frecuencia" },
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number]["key"];
