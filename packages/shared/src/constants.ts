/**
 * Constantes del dominio, compartidas entre frontend y backend.
 * Lo que es puramente de presentación vive en `apps/web/src/lib/constants.ts`.
 */

/** Valores por omisión de `GET /nearby`, según el contrato v1. */
export const NEARBY_DEFAULT_RADIUS_M = 500;
export const NEARBY_MAX_RADIUS_M = 2000;
export const NEARBY_DEFAULT_LIMIT = 20;

/** Valores por omisión de `POST /trip-plan`. */
export const TRIP_DEFAULT_MAX_WALK_M = 800;
export const TRIP_DEFAULT_MAX_TRANSFERS = 1;

/** Paginación de `GET /routes`. */
export const PAGE_DEFAULT_LIMIT = 20;
export const PAGE_MAX_LIMIT = 100;

/**
 * Promedio bayesiano de las calificaciones: `C` votos previos de valor `m`.
 * Evita que una ruta con dos votos perfectos desplace a una con doscientos.
 */
export const BAYESIAN_PRIOR_COUNT = 20;
export const BAYESIAN_PRIOR_MEAN = 3.5;

/** Longitud máxima del comentario de una calificación. */
export const RATING_COMMENT_MAX_LENGTH = 500;
