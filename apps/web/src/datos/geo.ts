/**
 * Geometría mínima para que los mocks se comporten como el backend.
 *
 * El backend real usa PostGIS (`ST_Distance` sobre `geography`). Aquí basta
 * una aproximación equirrectangular: a la escala de una ciudad el error es de
 * centímetros y nos ahorra meter una librería de 200 KB en los mocks.
 */

export type Posicion = [number, number];

const METROS_POR_GRADO_LAT = 110_540;
const METROS_POR_GRADO_LNG = 111_320;

function aMetros(punto: Posicion, latReferencia: number): [number, number] {
  return [
    punto[0] * METROS_POR_GRADO_LNG * Math.cos((latReferencia * Math.PI) / 180),
    punto[1] * METROS_POR_GRADO_LAT,
  ];
}

/**
 * Proyecta un punto sobre el segmento AB.
 *
 * Devuelve a qué distancia quedó y en qué fracción del segmento cayó, acotada
 * a [0, 1] para que la proyección nunca se salga de los extremos. Todo lo
 * demás de este archivo se arma sobre esto.
 */
function proyectarEnSegmento(p: Posicion, a: Posicion, b: Posicion) {
  const latRef = p[1];
  const [px, py] = aMetros(p, latRef);
  const [ax, ay] = aMetros(a, latRef);
  const [bx, by] = aMetros(b, latRef);

  const dx = bx - ax;
  const dy = by - ay;
  const largoCuadrado = dx * dx + dy * dy;
  const largo = Math.sqrt(largoCuadrado);

  if (largoCuadrado === 0) {
    return { fraccion: 0, largo: 0, distanciaM: Math.hypot(px - ax, py - ay) };
  }

  const fraccion = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largoCuadrado));
  return {
    fraccion,
    largo,
    distanciaM: Math.hypot(px - (ax + fraccion * dx), py - (ay + fraccion * dy)),
  };
}

/** Largo de un segmento, en metros. */
function largoSegmento(a: Posicion, b: Posicion): number {
  const [ax, ay] = aMetros(a, a[1]);
  const [bx, by] = aMetros(b, a[1]);
  return Math.hypot(bx - ax, by - ay);
}

/** Distancia entre dos puntos, en metros. */
export function distanciaEntre(a: Posicion, b: Posicion): number {
  return largoSegmento(a, b);
}

/** Distancia de un punto a una polilínea completa, en metros. */
export function distanciaATrazo(punto: Posicion, trazo: Posicion[]): number {
  let minima = Infinity;
  for (let i = 0; i < trazo.length - 1; i++) {
    const d = proyectarEnSegmento(punto, trazo[i]!, trazo[i + 1]!).distanciaM;
    if (d < minima) minima = d;
  }
  return minima;
}

export interface Proyeccion {
  /** Qué tan lejos está el punto del trazo, en metros. */
  distanciaM: number;
  /** Cuántos metros hay que recorrer el trazo para llegar a su altura. */
  avanceM: number;
  /** El punto **sobre el trazo**: dónde se sube o se baja de verdad. */
  punto: Posicion;
}

/**
 * Proyecta un punto sobre una polilínea: además de la distancia, **dónde**
 * cae a lo largo del recorrido.
 *
 * Eso es lo que permite responder si una ruta te sirve de verdad. Saber que
 * pasa cerca de ti y cerca de tu destino no basta: si pasa por tu destino
 * *antes* que por ti, en ese sentido no te lleva. Es el equivalente a
 * `ST_LineLocatePoint` de PostGIS, que es lo que usará el backend el día que
 * las rutas vivan en Postgres.
 */
export function proyectarEnTrazo(punto: Posicion, trazo: Posicion[]): Proyeccion {
  let mejor: Proyeccion = { distanciaM: Infinity, avanceM: 0, punto: trazo[0] ?? punto };
  let acumulado = 0;

  for (let i = 0; i < trazo.length - 1; i++) {
    const a = trazo[i]!;
    const b = trazo[i + 1]!;
    const { fraccion, largo, distanciaM } = proyectarEnSegmento(punto, a, b);

    if (distanciaM < mejor.distanciaM) {
      mejor = {
        distanciaM,
        avanceM: acumulado + fraccion * largo,
        // Interpolar en grados y no en metros introduce un error de
        // centímetros a esta escala, y a cambio no hay que deshacer la
        // proyección a metros.
        punto: [a[0] + (b[0] - a[0]) * fraccion, a[1] + (b[1] - a[1]) * fraccion],
      };
    }
    acumulado += largo;
  }

  return mejor;
}

/** El punto que está a una fracción dada del recorrido. Para poner etiquetas. */
export function puntoEnFraccion(trazo: Posicion[], fraccion: number): Posicion | null {
  if (trazo.length === 0) return null;
  if (trazo.length === 1) return trazo[0]!;

  const largos: number[] = [];
  let total = 0;
  for (let i = 0; i < trazo.length - 1; i++) {
    const largo = largoSegmento(trazo[i]!, trazo[i + 1]!);
    largos.push(largo);
    total += largo;
  }
  if (total === 0) return trazo[0]!;

  let objetivo = Math.max(0, Math.min(1, fraccion)) * total;
  for (let i = 0; i < largos.length; i++) {
    const largo = largos[i]!;
    if (objetivo <= largo || i === largos.length - 1) {
      const t = largo === 0 ? 0 : objetivo / largo;
      const a = trazo[i]!;
      const b = trazo[i + 1]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    objetivo -= largo;
  }
  return trazo[trazo.length - 1]!;
}

/** Recuadro [oeste, sur, este, norte] de una polilínea. */
export function recuadroDe(trazos: Posicion[][]): [number, number, number, number] {
  let oeste = Infinity;
  let sur = Infinity;
  let este = -Infinity;
  let norte = -Infinity;
  for (const trazo of trazos) {
    for (const [lng, lat] of trazo) {
      if (lng < oeste) oeste = lng;
      if (lng > este) este = lng;
      if (lat < sur) sur = lat;
      if (lat > norte) norte = lat;
    }
  }
  return [oeste, sur, este, norte];
}
