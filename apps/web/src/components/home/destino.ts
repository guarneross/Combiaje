/**
 * Un destino: el punto al que alguien quiere llegar.
 *
 * Va a la URL como `d=<lng>,<lat>` y `dn=<nombre>` —y no como el id de una
 * parada— porque el día que exista el geocodificador de verdad (hito S5) los
 * destinos van a ser direcciones y colonias que no tienen id en nuestra base.
 * Coordenadas más etiqueta es lo único que los dos mundos comparten, y así un
 * enlace compartido sigue abriendo la misma pantalla.
 */
export interface Destino {
  lat: number;
  lng: number;
  nombre: string;
}

/** `"-98.2063,19.0414"`. Cuatro decimales son ~11 m: de sobra para un destino. */
export function destinoACadena(destino: Destino): string {
  return `${destino.lng.toFixed(5)},${destino.lat.toFixed(5)}`;
}

/** Lo inverso. `null` si la cadena no es un par de coordenadas de Puebla. */
export function destinoDeCadena(valor: string | null, nombre: string | null): Destino | null {
  if (!valor) return null;
  const [lng, lat] = valor.split(",").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) return null;
  return { lat: lat!, lng: lng!, nombre: nombre?.trim() || "El punto que elegiste" };
}

/** Para comparar textos escritos a mano: sin mayúsculas y sin acentos. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
