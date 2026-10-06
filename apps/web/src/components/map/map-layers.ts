import type { LayerProps } from "react-map-gl/maplibre";

import { ROUTE_LINE_WIDTH, ROUTE_LINE_WIDTH_ACTIVE } from "@/lib/constants";

/**
 * Estilo de las capas de ruta.
 *
 * Todo lo que distingue una ruta de otra —color, grosor, opacidad— se resuelve
 * con expresiones de estilo de MapLibre, evaluadas en la GPU a partir de las
 * propiedades del dato. **Resaltar una ruta es cambiar una expresión, no
 * volver a pedir datos.** Esa es la razón de ser de toda la arquitectura del
 * mapa; si algún día alguien lo "arregla" pidiendo GeoJSON por ruta, la
 * aplicación muere en un teléfono real.
 *
 * Las expresiones se escriben como arreglos y se convierten con un solo `as`
 * por capa: tipar a mano cada expresión de MapLibre cuesta más de lo que
 * aporta, y la forma la valida el propio MapLibre en tiempo de ejecución.
 */

interface OpcionesCapa {
  /** Color del fondo para el halo del trazo. */
  colorHalo: string;
  /** Slug de la ruta resaltada, si hay alguna. */
  resaltada?: string | null;
  /**
   * Las teselas vectoriales exigen `source-layer`; una fuente GeoJSON se
   * queja si lo ve. Ver `use-routes-source.ts`.
   */
  capaDeTesela?: string | undefined;
}

/** Grosor que crece con el zoom: legible de lejos, preciso de cerca. */
function anchoPorZoom(base: number) {
  return ["interpolate", ["linear"], ["zoom"], 10, base * 0.6, 13, base, 16, base * 1.6, 18, base * 2.2];
}

/** El mismo ancho, pero distinto para la ruta resaltada que para las demás. */
function anchoResaltado(slug: string) {
  const porNivel = (activo: number, resto: number) => [
    "case",
    ["==", ["get", "slug"], slug],
    activo,
    resto,
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, porNivel(ROUTE_LINE_WIDTH_ACTIVE * 0.6, ROUTE_LINE_WIDTH * 0.6),
    13, porNivel(ROUTE_LINE_WIDTH_ACTIVE, ROUTE_LINE_WIDTH),
    16, porNivel(ROUTE_LINE_WIDTH_ACTIVE * 1.6, ROUTE_LINE_WIDTH * 1.6),
    18, porNivel(ROUTE_LINE_WIDTH_ACTIVE * 2.2, ROUTE_LINE_WIDTH * 2.2),
  ];
}

/**
 * Halo: una línea más ancha por debajo del trazo, del color del fondo.
 * Es lo que hace que un trazo de 4 px se distinga sobre una avenida gris o
 * sobre un parque verde. Sin él, la mitad de las rutas desaparecen.
 */
export function capaHalo({ colorHalo, resaltada, capaDeTesela }: OpcionesCapa): LayerProps {
  return {
    id: "rutas-halo",
    type: "line",
    ...(capaDeTesela ? { "source-layer": capaDeTesela } : {}),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colorHalo,
      "line-width": anchoPorZoom(ROUTE_LINE_WIDTH + 4),
      "line-opacity": resaltada
        ? ["case", ["==", ["get", "slug"], resaltada], 0.95, 0.2]
        : 0.85,
    },
  } as unknown as LayerProps;
}

/** El trazo. El color sale de la propiedad `color` del dato, no del código. */
export function capaRutas({ resaltada, capaDeTesela }: OpcionesCapa): LayerProps {
  return {
    id: "rutas",
    type: "line",
    ...(capaDeTesela ? { "source-layer": capaDeTesela } : {}),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#2563EB"],
      "line-width": resaltada ? anchoResaltado(resaltada) : anchoPorZoom(ROUTE_LINE_WIDTH),
      // Las rutas no resaltadas no desaparecen: se apagan. Que sigan visibles
      // es lo que deja ver que hay alternativas.
      "line-opacity": resaltada ? ["case", ["==", ["get", "slug"], resaltada], 1, 0.3] : 1,
    },
  } as unknown as LayerProps;
}

/**
 * Paradas. Solo a partir de zoom 13: antes, cien puntos sobre la ciudad son
 * ruido que tapa los trazos.
 */
export function capaParadas({ colorHalo, capaDeTesela }: OpcionesCapa): LayerProps {
  return {
    id: "paradas",
    type: "circle",
    ...(capaDeTesela ? { "source-layer": capaDeTesela } : {}),
    minzoom: 13,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 16, 5, 18, 7],
      "circle-color": colorHalo,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#64748B",
      "circle-opacity": 0.95,
    },
  } as unknown as LayerProps;
}

/** Capa invisible y ancha, solo para que el dedo pueda tocar un trazo. */
export function capaToque({ capaDeTesela }: OpcionesCapa): LayerProps {
  return {
    id: "rutas-toque",
    type: "line",
    ...(capaDeTesela ? { "source-layer": capaDeTesela } : {}),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#000000",
      "line-opacity": 0,
      // 24 px: el ancho mínimo para acertarle a una línea con el pulgar.
      "line-width": 24,
    },
  } as unknown as LayerProps;
}
