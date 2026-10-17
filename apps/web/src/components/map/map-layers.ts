import type { LayerProps } from "react-map-gl/maplibre";

import { ROUTE_LINE_WIDTH, ROUTE_LINE_WIDTH_ACTIVE } from "@/lib/constants";

/**
 * Estilo de las capas de ruta.
 *
 * Todo lo que distingue una ruta de otra —color, grosor, opacidad, de qué lado
 * de la calle se dibuja— se resuelve con expresiones de estilo de MapLibre,
 * evaluadas en la GPU a partir de las propiedades del dato. **Resaltar una
 * ruta, o cambiar cuáles se ven, es cambiar una expresión, no volver a pedir
 * datos.** Esa es la razón de ser de toda la arquitectura del mapa; si algún
 * día alguien lo "arregla" pidiendo GeoJSON por ruta, la aplicación muere en un
 * teléfono real.
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
   * Qué rutas se dibujan. `null` es «todas» —la vista de la red completa—;
   * `[]` es «ninguna», que es con lo que abre la pantalla principal.
   */
  visibles?: string[] | null;
  /** Desfase en píxeles por slug. Ver `desfasesPara`. */
  desfases?: Record<string, number> | undefined;
  /**
   * `"principal"` dibuja solo el sentido de ida. Es lo normal: ida y vuelta
   * recorren casi las mismas calles, así que pintar las dos duplica cada línea
   * sin decir nada nuevo. La ficha de ruta sí usa `"ambos"`, porque ahí el
   * recorrido completo es el tema.
   */
  sentido?: "principal" | "ambos";
  /**
   * Las teselas vectoriales exigen `source-layer`; una fuente GeoJSON se
   * queja si lo ve. Ver `use-routes-source.ts`.
   */
  capaDeTesela?: string | undefined;
}

/**
 * Medio carril de separación.
 *
 * Con esto, ida y vuelta de una misma ruta caen cada una a su lado de la
 * calle, como el tráfico de verdad: la geometría de la vuelta va al revés, así
 * que un desfase constante las manda a lados opuestos sin tener que saber cuál
 * es cuál.
 */
const CARRIL = 2;

/**
 * Separación entre rutas distintas que comparten la misma avenida.
 *
 * Seis píxeles y no más: `line-offset` deforma el trazo en las vueltas
 * cerradas —en una horquilla la línea desplazada se cruza consigo misma y se
 * ve un manchón—, y el tamaño del manchón es proporcional al desfase. Seis
 * separa lo suficiente para distinguir tres rutas en la misma calle sin que
 * las vueltas se ensucien.
 */
const PASO_DESFASE = 6;

/**
 * Reparte desfases para que trazos que van por la misma calle no se tapen.
 *
 * Es el problema que se ve en cuanto hay dos rutas: en Puebla casi todas pasan
 * por el centro, y sin esto la de arriba borra a la de abajo y parece que solo
 * existe una. Se alternan a izquierda y derecha desde el eje para que ninguna
 * quede sistemáticamente lejos de su calle real.
 */
export function desfasesPara(slugs: readonly string[]): Record<string, number> {
  const desfases: Record<string, number> = {};
  slugs.forEach((slug, i) => {
    const nivel = Math.ceil(i / 2);
    desfases[slug] = (i % 2 === 0 ? 1 : -1) * nivel * PASO_DESFASE;
  });
  return desfases;
}

/**
 * Escala un valor con el zoom: legible de lejos, preciso de cerca.
 *
 * El `interpolate` tiene que quedar **arriba**, no dentro de un `*`: MapLibre
 * solo acepta `["zoom"]` como entrada de un `interpolate` o `step` de primer
 * nivel, y una expresión que lo anide se rechaza entera. Al rechazarla, el
 * estilo no carga y la pantalla acaba mostrando «no pudimos cargar el mapa»
 * con el mapa perfectamente sano detrás. Pasó; de ahí este comentario.
 *
 * `valorBase` puede ser un número o una expresión —un `match` por slug, por
 * ejemplo—: lo que no puede es depender del zoom.
 */
function porZoom(valorBase: unknown) {
  const escalado = (factor: number) =>
    typeof valorBase === "number" ? valorBase * factor : ["*", valorBase, factor];

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    escalado(0.6),
    13,
    escalado(1),
    16,
    escalado(1.6),
    18,
    escalado(2.2),
  ];
}

/** El ancho del trazo, distinto para la ruta resaltada que para las demás. */
function anchoResaltado(slug: string) {
  return porZoom(["case", ["==", ["get", "slug"], slug], ROUTE_LINE_WIDTH_ACTIVE, ROUTE_LINE_WIDTH]);
}

/**
 * El desfase **se encoge al acercarse**, al revés que el grosor.
 *
 * Es lo contrario de lo que parece natural, y la razón es que a cada zoom se
 * está haciendo una pregunta distinta. De lejos: «¿cuántas rutas pasan por
 * aquí?» —y si dos trazos se encinan, la respuesta es «una»—. De cerca: «¿este
 * camión baja por mi calle?», y ahí un trazo diez píxeles al lado de la
 * avenida es sencillamente un trazo mal dibujado.
 *
 * Así que la separación vive donde hace falta (zoom de ciudad) y se va
 * desvaneciendo hasta casi cero a nivel de calle, donde cada línea se para
 * sobre su geometría de verdad. La primera versión lo hacía al revés —el
 * desfase crecía con el zoom, igual que el grosor— y a zoom 18 las rutas
 * salían despegadas del bulevar.
 */
function desfasePorZoom(desfases: Record<string, number> | undefined) {
  const entradas = Object.entries(desfases ?? {});
  if (entradas.length === 0) return CARRIL;

  const porSlug: unknown[] = ["match", ["get", "slug"]];
  for (const [slug, px] of entradas) porSlug.push(slug, px);
  porSlug.push(0);

  // El medio carril es constante —dos píxeles caben en cualquier calle—; lo
  // que se encoge es la separación ENTRE rutas, que es la que a zoom de calle
  // mandaba el trazo a la acera de enfrente.
  const conFactor = (factor: number) => ["+", CARRIL, ["*", porSlug, factor]];

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    // Ciudad completa: toda la separación, que es cuando se encima todo.
    11,
    conFactor(1),
    14,
    conFactor(1),
    // Barrio: ya se distinguen solas, empieza a estorbar.
    16,
    conFactor(0.5),
    // Calle: cada trazo sobre su geometría, salvo el medio carril.
    18,
    conFactor(0.1),
  ];
}

/**
 * Qué se dibuja y qué no.
 *
 * `undefined` significa «sin filtro», que es lo que hay que pasarle a MapLibre
 * cuando no hay nada que filtrar: un filtro `["all"]` vacío es válido pero
 * obliga a evaluar la expresión por cada rasgo sin motivo.
 */
function filtroDe({ visibles, sentido = "principal" }: OpcionesCapa) {
  const condiciones: unknown[] = [];

  if (visibles) condiciones.push(["in", ["get", "slug"], ["literal", visibles]]);
  // `coalesce` porque una tesela vieja puede no traer la propiedad; en ese caso
  // más vale dibujar la línea que esconderla.
  if (sentido === "principal") {
    condiciones.push(["==", ["coalesce", ["get", "isPrimary"], true], true]);
  }

  if (condiciones.length === 0) return undefined;
  return ["all", ...condiciones];
}

/** Lo que comparten todas las capas de línea: el filtro, el desfase y las uniones. */
function baseDeLinea(opciones: OpcionesCapa) {
  const filtro = filtroDe(opciones);
  return {
    type: "line" as const,
    ...(opciones.capaDeTesela ? { "source-layer": opciones.capaDeTesela } : {}),
    ...(filtro ? { filter: filtro } : {}),
    layout: { "line-cap": "round", "line-join": "round" },
    desfase: desfasePorZoom(opciones.desfases),
  };
}

/**
 * Halo: una línea más ancha por debajo del trazo, del color del fondo.
 * Es lo que hace que un trazo de 4 px se distinga sobre una avenida gris o
 * sobre un parque verde. Sin él, la mitad de las rutas desaparecen.
 */
export function capaHalo(opciones: OpcionesCapa): LayerProps {
  const { colorHalo, resaltada } = opciones;
  const { desfase, ...base } = baseDeLinea(opciones);

  return {
    id: "rutas-halo",
    ...base,
    paint: {
      "line-color": colorHalo,
      "line-width": porZoom(ROUTE_LINE_WIDTH + 4),
      "line-offset": desfase,
      "line-opacity": resaltada ? ["case", ["==", ["get", "slug"], resaltada], 0.95, 0.25] : 0.85,
    },
  } as unknown as LayerProps;
}

/** El trazo. El color sale de la propiedad `color` del dato, no del código. */
export function capaRutas(opciones: OpcionesCapa): LayerProps {
  const { resaltada } = opciones;
  const { desfase, ...base } = baseDeLinea(opciones);

  return {
    id: "rutas",
    ...base,
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#2563EB"],
      "line-width": resaltada ? anchoResaltado(resaltada) : porZoom(ROUTE_LINE_WIDTH),
      "line-offset": desfase,
      // Las rutas no resaltadas no desaparecen: se apagan. Que sigan visibles
      // es lo que deja ver que hay alternativas.
      "line-opacity": resaltada ? ["case", ["==", ["get", "slug"], resaltada], 1, 0.4] : 1,
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

/**
 * Capa invisible y ancha, solo para que el dedo pueda tocar un trazo.
 * Lleva el mismo desfase que el trazo visible: si no, el toque cae al lado de
 * la línea que la persona ve.
 */
export function capaToque(opciones: OpcionesCapa): LayerProps {
  const { desfase, ...base } = baseDeLinea(opciones);

  return {
    id: "rutas-toque",
    ...base,
    paint: {
      "line-color": "#000000",
      "line-opacity": 0,
      // 24 px: el ancho mínimo para acertarle a una línea con el pulgar.
      "line-width": 24,
      "line-offset": desfase,
    },
  } as unknown as LayerProps;
}
