import { z } from "zod";

import { agencySchema } from "./agency";
import { hexColorSchema, slugSchema, uuidSchema } from "./primitives";

export const routeStatusSchema = z.enum(["draft", "published", "archived"]);
export const dataSourceSchema = z.enum(["osm", "manual", "gps", "official"]);

/**
 * Una denominación: cómo se llamaba y de qué color era la ruta en un periodo.
 *
 * ⚠️ Existe por un hecho de la calle: la SMT anunció el 12 de septiembre de
 * 2026 el cambio de número y color de **95 rutas** del área metropolitana, de
 * forma gradual hasta antes de 2028. Dividieron la zona en 21 cuencas, cada una
 * con su color, y cada ruta lleva el color de su cuenca más otro de
 * identificación. Los recorridos NO cambian.
 *
 * Durante esos dos años la gente va a conocer el número viejo mientras el
 * camión trae el nuevo. Guardar las dos denominaciones —y **buscar por las
 * dos**— es lo que vuelve a Combiaje útil en la transición. Un dato
 * institucional sobrescribe el valor viejo y pierde la correspondencia;
 * nosotros no.
 */
export const denominationSchema = z.object({
  shortName: z.string(),
  longName: z.string().nullable(),
  /** Uno o dos colores. Desde 2026 la SMT asigna dos: cuenca + identificación. */
  colors: z.array(hexColorSchema).min(1).max(2),
  /** Cuenca de la nomenclatura 2026, cuando se conoce. */
  basin: z.string().nullable(),
  /** `null` si no se sabe desde cuándo. Formato AAAA-MM-DD. */
  from: z.string().nullable(),
  /** `null` mientras siga vigente. */
  until: z.string().nullable(),
  /** La vigente es la que se muestra en grande. Solo una debe serlo. */
  current: z.boolean(),
  /** De dónde salió el dato: "smt", "campo", "comunidad". */
  source: z.string().nullable(),
});

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

  /** Segundo color de la nomenclatura 2026. `null` con la vieja. */
  colorSecondary: hexColorSchema.nullable().default(null),
  /** Cuenca asignada por la SMT, cuando se conoce. */
  basin: z.string().nullable().default(null),
  /**
   * Historial de nombres y colores, del más viejo al más nuevo.
   * Vacío mientras la ruta no haya cambiado de denominación.
   *
   * La búsqueda debe indexar **todos** los `shortName` de aquí, no solo el
   * vigente: alguien que escribe «38A» tiene que encontrar la que hoy es 061.
   */
  denominations: z.array(denominationSchema).default([]),
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

export type Denomination = z.infer<typeof denominationSchema>;
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
