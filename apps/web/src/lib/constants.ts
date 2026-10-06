/**
 * Constantes de la aplicación web.
 *
 * Ojo: las constantes del DOMINIO (paleta oficial de colores de ruta, radios
 * por omisión del contrato) son de `@combiaje/shared` y las define
 * Arquitectura. Aquí solo vive lo que es puramente de presentación.
 */

/** Zócalo de Puebla. Centro del encuadre inicial del mapa. */
export const PUEBLA_CENTER = { lng: -98.2063, lat: 19.0414 } as const;

export const MAP_DEFAULT_ZOOM = 12;
export const MAP_MIN_ZOOM = 9;
export const MAP_MAX_ZOOM = 18;

/**
 * Recuadro del área metropolitana (Puebla, Cholula, Amozoc, Cuautlancingo).
 * Sirve para acotar el mapa y para limitar la geocodificación.
 * [oeste, sur, este, norte]
 */
export const PUEBLA_BBOX = [-98.42, 18.89, -98.03, 19.17] as const;

/** Grosor del trazo de ruta y su halo. El halo es lo que lo hace legible. */
export const ROUTE_LINE_WIDTH = 4;
export const ROUTE_LINE_WIDTH_ACTIVE = 6;
export const ROUTE_HALO_WIDTH = 2;

/** Radio por omisión de "rutas cerca de mí", en metros. */
export const NEARBY_DEFAULT_RADIUS_M = 500;
export const NEARBY_MAX_RESULTS = 20;

/** Atribución obligatoria. ODbL: no es opcional ni decorativa. */
export const MAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a> · Datos de Combiaje bajo ODbL';

export const SITE_NAME = "Combiaje";
export const SITE_DESCRIPTION =
  "Qué camión te lleva a dónde vas. Mapa del transporte público de Puebla, hecho por la comunidad.";
