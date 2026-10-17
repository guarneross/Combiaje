"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addProtocol, type MapLayerMouseEvent } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useTheme } from "next-themes";
import Map, {
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  ScaleControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";

import { ErrorState } from "@/components/feedback/error-state";
import { MapSkeleton } from "@/components/feedback/skeletons";
import { puntoEnFraccion, type Posicion } from "@/datos/geo";
import {
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  PUEBLA_BBOX,
  PUEBLA_CENTER,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import { capaHalo, capaParadas, capaRutas, capaToque, desfasesPara } from "./map-layers";
import { useRoutesSource } from "./use-routes-source";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * El mapa de Combiaje.
 *
 * Encapsula de dónde salen los trazos (teselas o GeoJSON), el estilo
 * claro/oscuro, los controles y la atribución. Las pantallas le dicen **qué
 * rutas dibujar** y reciben qué se tocó; nada más.
 *
 * Que la pantalla decida qué se dibuja es lo que arregló el problema de fondo:
 * el mapa pintaba todo el catálogo al abrir, ida y vuelta de cada ruta, y con
 * dos rutas trazadas ya parecía un nudo. Ahora abre vacío y el dibujo es la
 * respuesta a una pregunta: a dónde vas, o qué pasa por aquí.
 *
 * Se carga con `next/dynamic` desde `./index.ts`: MapLibre pesa unos 250 KB
 * comprimidos y no debe estar en el paquete inicial.
 */

/** El protocolo pmtiles se registra una sola vez por carga de página. */
let protocoloRegistrado = false;
function registrarPmtiles() {
  if (protocoloRegistrado || typeof window === "undefined") return;
  const protocolo = new Protocol();
  addProtocol("pmtiles", protocolo.tile);
  protocoloRegistrado = true;
}

/**
 * Un poco de holgura alrededor del área metropolitana, para que no se sienta
 * preso pero tampoco se pueda navegar hasta Canadá.
 * Formato plano [oeste, sur, este, norte], que es el que espera react-map-gl 8.
 */
const LIMITES: [number, number, number, number] = [
  PUEBLA_BBOX[0] - 0.25,
  PUEBLA_BBOX[1] - 0.25,
  PUEBLA_BBOX[2] + 0.25,
  PUEBLA_BBOX[3] + 0.25,
];

/** Relleno de encuadre por omisión: solo aire, sin nada que esquivar. */
const RELLENO_BASE: Relleno = { top: 40, bottom: 40, left: 32, right: 32 };

/** Más etiquetas que esto sobre el mapa ya es ruido. */
const MAXIMO_ETIQUETAS = 6;

export interface Relleno {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Recorta el relleno para que quepa en el contenedor.
 *
 * MapLibre no valida esto: si el relleno inferior mide más que el mapa, el
 * encuadre sale sin sentido. Pasó en la ficha de ruta, donde el mapa mide 208
 * px de alto y heredaba los 280 px de relleno pensados para la hoja de la
 * pantalla principal: la ruta salía diminuta y fuera de cuadro.
 */
function recortarRelleno(relleno: Relleno, ancho: number, alto: number): Relleno {
  const encoger = (a: number, b: number, disponible: number) => {
    const util = Math.max(disponible - 40, 0); // 40 px de lienzo mínimo
    const total = a + b;
    if (total <= util) return [a, b] as const;
    const factor = total === 0 ? 0 : util / total;
    return [Math.floor(a * factor), Math.floor(b * factor)] as const;
  };

  const [top, bottom] = encoger(relleno.top, relleno.bottom, alto);
  const [left, right] = encoger(relleno.left, relleno.right, ancho);
  return { top, bottom, left, right };
}

export interface CombiajeMapProps {
  /**
   * Qué rutas dibujar, por slug y en orden de importancia. `[]` deja el mapa
   * limpio —así abre la pantalla principal— y `null` dibuja todas, que es solo
   * para la vista de la red completa.
   */
  rutasVisibles?: readonly string[] | null;
  /** Slug de la ruta a resaltar. Las demás se atenúan, no desaparecen. */
  rutaResaltada?: string | null;
  /**
   * `"principal"` dibuja solo el sentido de ida: ida y vuelta van por casi las
   * mismas calles y pintar las dos duplica cada línea. La ficha de ruta pasa
   * `"ambos"`, porque ahí el recorrido completo es el tema.
   */
  sentido?: "principal" | "ambos";
  /** Se dispara al tocar un trazo. Recibe el slug. */
  onSeleccionarRuta?: (slug: string) => void;
  /** Se dispara al tocar el mapa fuera de un trazo. */
  onTocarMapa?: (punto: { lat: number; lng: number }) => void;
  /** El destino elegido, para que se vea a dónde apuntan los trazos. */
  marcaDestino?: { lat: number; lng: number; nombre: string } | null;
  /** Si llega una coordenada nueva, el mapa vuela hasta ahí. */
  centrarEn?: { lat: number; lng: number } | null;
  /**
   * Píxeles que la pantalla tapa con sus propios controles. Lo sabe la
   * pantalla, no el mapa: la principal tiene una hoja que cubre el tercio de
   * abajo; la ficha de ruta, nada.
   */
  relleno?: Relleno;
  /** Controles y hojas que flotan encima del mapa. */
  children?: ReactNode;
  className?: string;
}

export function CombiajeMap({
  rutasVisibles = null,
  rutaResaltada = null,
  sentido = "principal",
  onSeleccionarRuta,
  onTocarMapa,
  marcaDestino = null,
  centrarEn = null,
  relleno = RELLENO_BASE,
  children,
  className,
}: CombiajeMapProps) {
  registrarPmtiles();

  const mapaRef = useRef<MapRef>(null);
  const [listo, setListo] = useState(false);
  const [falloEstilo, setFalloEstilo] = useState(false);
  /** Sube cada vez que el contenedor cambia de tamaño. Ver más abajo. */
  const [medida, setMedida] = useState(0);
  const { resolvedTheme } = useTheme();

  // La lista de slugs llega como arreglo y cambia de identidad en cada render
  // de la pantalla. Se normaliza a una cadena para que los `useMemo` y los
  // efectos de abajo no se disparen cuando el contenido es el mismo.
  const claveVisibles = rutasVisibles ? rutasVisibles.join("|") : "*";
  const visibles = useMemo<string[] | null>(() => {
    if (claveVisibles === "*") return null;
    return claveVisibles === "" ? [] : claveVisibles.split("|");
  }, [claveVisibles]);

  const fuente = useRoutesSource(visibles);

  const estiloUrl =
    resolvedTheme === "dark" ? env.NEXT_PUBLIC_MAP_STYLE_URL_DARK : env.NEXT_PUBLIC_MAP_STYLE_URL;

  /**
   * Color del halo del trazo: claro sobre mapa claro, oscuro sobre mapa
   * oscuro. Se lee del token CSS para que tema y mapa no se desincronicen.
   */
  const colorHalo = useMemo(
    () => (resolvedTheme === "dark" ? "#15181f" : "#ffffff"),
    [resolvedTheme],
  );

  /**
   * Los trazos que de verdad hay en la fuente, por slug. Objeto llano y no un
   * `Map` porque `Map` aquí es el componente de react-map-gl.
   */
  const trazosPorSlug = useMemo(() => {
    const porSlug: Record<string, { color: string; shortName: string; trazo: Posicion[] }> = {};
    if (fuente.tipo !== "geojson") return porSlug;

    for (const rasgo of fuente.datos.features) {
      const props = rasgo.properties ?? {};
      const slug = props["slug"];
      if (typeof slug !== "string" || rasgo.geometry.type !== "LineString") continue;
      // La etiqueta y el encuadre se calculan sobre el sentido principal.
      if (porSlug[slug] && props["isPrimary"] !== true) continue;
      porSlug[slug] = {
        color: typeof props["color"] === "string" ? props["color"] : "#2563EB",
        shortName: typeof props["shortName"] === "string" ? props["shortName"] : "",
        trazo: rasgo.geometry.coordinates as Posicion[],
      };
    }
    return porSlug;
  }, [fuente]);

  /** De qué lado de la calle va cada ruta. Ver `desfasesPara`. */
  const desfases = useMemo(
    () => desfasesPara(visibles ?? Object.keys(trazosPorSlug)),
    [visibles, trazosPorSlug],
  );

  const opcionesCapa = { colorHalo, resaltada: rutaResaltada, visibles, desfases, sentido };

  /**
   * El número de ruta, en una pastilla sobre su trazo.
   *
   * Va como marcador de React y no como capa de símbolos a propósito: una capa
   * `symbol` necesita que el estilo del mapa sirva los glifos de la tipografía,
   * y si falta uno MapLibre lanza un error por cada rasgo. Con dos o tres rutas
   * dibujadas, tres nodos del DOM cuestan menos que esa dependencia.
   */
  const etiquetas = useMemo(() => {
    if (!visibles || visibles.length === 0 || visibles.length > MAXIMO_ETIQUETAS) return [];

    return visibles.flatMap((slug, i) => {
      const datos = trazosPorSlug[slug];
      if (!datos || !datos.shortName) return [];
      // Repartidas a lo largo del recorrido para que no se amontonen todas en
      // el centro, que es justo por donde pasan casi todas.
      const punto = puntoEnFraccion(datos.trazo, (i + 1) / (visibles.length + 1));
      if (!punto) return [];
      return [{ slug, punto, color: datos.color, shortName: datos.shortName }];
    });
  }, [visibles, trazosPorSlug]);

  const capasInteractivas = useMemo(
    () => (onSeleccionarRuta ? ["rutas-toque"] : []),
    [onSeleccionarRuta],
  );

  const alTocar = useCallback(
    (evento: MapLayerMouseEvent) => {
      const slug = evento.features?.[0]?.properties?.["slug"];
      if (typeof slug === "string" && onSeleccionarRuta) {
        onSeleccionarRuta(slug);
        return;
      }
      onTocarMapa?.({ lat: evento.lngLat.lat, lng: evento.lngLat.lng });
    },
    [onSeleccionarRuta, onTocarMapa],
  );

  /** El relleno de la pantalla, recortado a lo que de verdad cabe. */
  const rellenoUtil = useCallback(() => {
    const mapa = mapaRef.current;
    if (!mapa) return relleno;
    const { width, height } = mapa.getContainer().getBoundingClientRect();
    return recortarRelleno(relleno, width, height);
  }, [relleno]);

  /**
   * Si el contenedor cambia de tamaño, el lienzo se entera.
   *
   * MapLibre solo escucha el `resize` de la ventana, y eso no cubre el caso
   * que importa aquí: la ficha de ruta deja ampliar el mapa a pantalla
   * completa sin que la ventana cambie de tamaño. Sin esto, el lienzo se
   * queda con las medidas viejas y el mapa sale estirado dentro del hueco
   * nuevo.
   */
  useEffect(() => {
    const contenedor = mapaRef.current?.getContainer();
    if (!listo || !contenedor || typeof ResizeObserver === "undefined") return;

    const observador = new ResizeObserver(() => {
      mapaRef.current?.resize();
      // Y se vuelve a encuadrar: con el doble de alto disponible, el
      // recorrido tiene que volver a ocupar el cuadro. Si no, ampliar el mapa
      // solo agrega espacio vacío debajo de la ruta.
      setMedida((previa) => previa + 1);
    });
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [listo]);

  // Al ubicar al usuario, llevarlo al centro. El relleno inferior deja al
  // punto por encima de la hoja, no debajo.
  useEffect(() => {
    if (!listo || !centrarEn) return;
    mapaRef.current?.easeTo({
      center: [centrarEn.lng, centrarEn.lat],
      zoom: Math.max(mapaRef.current.getZoom(), 14),
      padding: rellenoUtil(),
      duration: 800,
    });
  }, [listo, centrarEn, rellenoUtil]);

  /**
   * Encuadrar lo que se está dibujando.
   *
   * Si hay una ruta resaltada, esa; si no, todas las visibles juntas —que es
   * lo que hace falta cuando la pantalla acaba de recomendar tres—. Con
   * `rutasVisibles = null` no se toca el encuadre: la vista de la red completa
   * ya abre sobre la ciudad.
   */
  const claveEncuadre = `${rutaResaltada ?? claveVisibles}@${
    marcaDestino ? `${marcaDestino.lng},${marcaDestino.lat}` : ""
  }`;
  useEffect(() => {
    if (!listo) return;
    const aEncuadrar = rutaResaltada ? [rutaResaltada] : visibles;
    if (!aEncuadrar || aEncuadrar.length === 0) return;

    let oeste = Infinity,
      sur = Infinity,
      este = -Infinity,
      norte = -Infinity;

    // El destino entra en el cuadro: si queda fuera, la pantalla dibuja la
    // ruta que te lleva y esconde a dónde te lleva.
    if (marcaDestino) {
      oeste = este = marcaDestino.lng;
      sur = norte = marcaDestino.lat;
    }

    for (const slug of aEncuadrar) {
      const datos = trazosPorSlug[slug];
      if (!datos) continue;
      for (const [lng, lat] of datos.trazo) {
        if (lng < oeste) oeste = lng;
        if (lng > este) este = lng;
        if (lat < sur) sur = lat;
        if (lat > norte) norte = lat;
      }
    }
    if (!Number.isFinite(oeste)) return;

    mapaRef.current?.fitBounds(
      [
        [oeste, sur],
        [este, norte],
      ],
      { padding: rellenoUtil(), duration: 600, maxZoom: 15 },
    );
    // `claveEncuadre` resume qué hay que encuadrar; `trazosPorSlug` es lo que
    // cambia cuando por fin llega la geometría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, claveEncuadre, trazosPorSlug, rellenoUtil, medida]);

  if (falloEstilo) {
    return (
      <div className={cn("bg-map-surface grid size-full place-items-center", className)}>
        <ErrorState
          titulo="No pudimos cargar el mapa"
          descripcion="Revisa tu conexión. Mientras tanto, puedes usar la lista de rutas."
          onReintentar={() => {
            setFalloEstilo(false);
            setListo(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative size-full", className)}>
      <Map
        ref={mapaRef}
        initialViewState={{
          longitude: PUEBLA_CENTER.lng,
          latitude: PUEBLA_CENTER.lat,
          zoom: MAP_DEFAULT_ZOOM,
        }}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        maxBounds={LIMITES}
        mapStyle={estiloUrl}
        style={{ width: "100%", height: "100%" }}
        // La atribución va en un control propio para poder incluir la de ODbL.
        attributionControl={false}
        interactiveLayerIds={capasInteractivas}
        onClick={alTocar}
        onLoad={() => setListo(true)}
        onError={(e) => {
          console.error("[combiaje] mapa", e?.error ?? e);
          // Solo es fatal si el mapa nunca llegó a cargar. Después, un error
          // es casi siempre una tesela que no respondió o un recurso que
          // falta: tirar la pantalla entera por eso deja a la gente sin mapa
          // teniendo uno perfectamente usable enfrente.
          //
          // Y en un microtask: MapLibre puede avisar mientras React está
          // pintando las capas, y cambiar el estado ahí mismo es la
          // advertencia «no actualices un componente durante el render de
          // otro».
          queueMicrotask(() => setFalloEstilo((anterior) => anterior || !listo));
        }}
        // Gestos pensados para una mano: nada de rotar sin querer.
        dragRotate={false}
        touchPitch={false}
        reuseMaps
      >
        {fuente.tipo === "vector" ? (
          <Source id="rutas" type="vector" url={fuente.url}>
            <Layer {...capaHalo({ ...opcionesCapa, capaDeTesela: "routes" })} />
            <Layer {...capaRutas({ ...opcionesCapa, capaDeTesela: "routes" })} />
            <Layer {...capaParadas({ ...opcionesCapa, capaDeTesela: "stops" })} />
            <Layer {...capaToque({ ...opcionesCapa, capaDeTesela: "routes" })} />
          </Source>
        ) : (
          <Source id="rutas" type="geojson" data={fuente.datos}>
            {/* Una fuente GeoJSON no lleva `source-layer`. */}
            <Layer {...capaHalo(opcionesCapa)} />
            <Layer {...capaRutas(opcionesCapa)} />
            <Layer {...capaToque(opcionesCapa)} />
          </Source>
        )}

        {marcaDestino ? (
          <Marker
            longitude={marcaDestino.lng}
            latitude={marcaDestino.lat}
            anchor="bottom"
            style={{ pointerEvents: "none" }}
          >
            <span className="flex flex-col items-center">
              <span className="bg-background/95 border-primary/40 mb-1 max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                {marcaDestino.nombre}
              </span>
              <span
                aria-hidden="true"
                className="bg-primary border-background size-3.5 rounded-full border-2 shadow"
              />
            </span>
          </Marker>
        ) : null}

        {etiquetas.map((etiqueta) => (
          <Marker
            key={etiqueta.slug}
            longitude={etiqueta.punto[0]}
            latitude={etiqueta.punto[1]}
            // Sin `pointer-events`: la etiqueta no debe robarle el toque al
            // trazo que tiene debajo.
            style={{ pointerEvents: "none" }}
          >
            <span
              className="border-background/80 rounded-full border-2 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-md"
              style={{ backgroundColor: etiqueta.color }}
            >
              {etiqueta.shortName}
            </span>
          </Marker>
        ))}

        <NavigationControl position="top-right" showCompass={false} />
        <GeolocateControl
          position="top-right"
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation
        />
        <ScaleControl position="bottom-left" unit="metric" maxWidth={90} />
        {/* Sin AttributionControl a propósito: en móvil la hoja inferior lo
            taparía, y la atribución de ODbL no puede quedar escondida. La
            pantalla la pinta siempre visible, con MAP_ATTRIBUTION. */}
      </Map>

      {!listo ? (
        <div className="pointer-events-none absolute inset-0">
          <MapSkeleton />
        </div>
      ) : null}

      {children}
    </div>
  );
}
