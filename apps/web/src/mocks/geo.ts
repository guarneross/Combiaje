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

/** Distancia de un punto al segmento AB, en metros. */
function distanciaASegmento(p: Posicion, a: Posicion, b: Posicion): number {
  const latRef = p[1];
  const [px, py] = aMetros(p, latRef);
  const [ax, ay] = aMetros(a, latRef);
  const [bx, by] = aMetros(b, latRef);

  const dx = bx - ax;
  const dy = by - ay;
  const largoCuadrado = dx * dx + dy * dy;
  if (largoCuadrado === 0) return Math.hypot(px - ax, py - ay);

  // Proyección del punto sobre el segmento, acotada a [0, 1].
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largoCuadrado));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distancia de un punto a una polilínea completa, en metros. */
export function distanciaATrazo(punto: Posicion, trazo: Posicion[]): number {
  let minima = Infinity;
  for (let i = 0; i < trazo.length - 1; i++) {
    const d = distanciaASegmento(punto, trazo[i]!, trazo[i + 1]!);
    if (d < minima) minima = d;
  }
  return minima;
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
