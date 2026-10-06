"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addProtocol, type MapLayerMouseEvent } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useTheme } from "next-themes";
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";

import { ErrorState } from "@/components/feedback/error-state";
import { MapSkeleton } from "@/components/feedback/skeletons";
import {
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  PUEBLA_BBOX,
  PUEBLA_CENTER,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import { capaHalo, capaParadas, capaRutas, capaToque } from "./map-layers";
import { useRoutesSource } from "./use-routes-source";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * El mapa de Combiaje.
 *
 * Encapsula de dónde salen los trazos (teselas o GeoJSON de desarrollo), el
 * estilo claro/oscuro, los controles y la atribución. Las pantallas le pasan
 * qué resaltar y reciben qué se tocó; nada más.
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
  /** Slug de la ruta a resaltar. Las demás se atenúan, no desaparecen. */
  rutaResaltada?: string | null;
  /** Se dispara al tocar un trazo. Recibe el slug. */
  onSeleccionarRuta?: (slug: string) => void;
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
  rutaResaltada = null,
  onSeleccionarRuta,
  centrarEn = null,
  relleno = RELLENO_BASE,
  children,
  className,
}: CombiajeMapProps) {
  registrarPmtiles();

  const mapaRef = useRef<MapRef>(null);
  const [listo, setListo] = useState(false);
  const [falloEstilo, setFalloEstilo] = useState(false);
  const { resolvedTheme } = useTheme();
  const fuente = useRoutesSource();

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

  const capasInteractivas = useMemo(
    () => (onSeleccionarRuta ? ["rutas-toque"] : []),
    [onSeleccionarRuta],
  );

  const alTocar = useCallback(
    (evento: MapLayerMouseEvent) => {
      const slug = evento.features?.[0]?.properties?.["slug"];
      if (typeof slug === "string" && onSeleccionarRuta) onSeleccionarRuta(slug);
    },
    [onSeleccionarRuta],
  );

  /** El relleno de la pantalla, recortado a lo que de verdad cabe. */
  const rellenoUtil = useCallback(() => {
    const mapa = mapaRef.current;
    if (!mapa) return relleno;
    const { width, height } = mapa.getContainer().getBoundingClientRect();
    return recortarRelleno(relleno, width, height);
  }, [relleno]);

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

  // Al resaltar una ruta, encuadrarla dentro del espacio que de verdad se ve.
  useEffect(() => {
    if (!listo || !rutaResaltada || fuente.tipo !== "geojson") return;
    const rasgos = fuente.datos.features.filter(
      (rasgo) => rasgo.properties?.["slug"] === rutaResaltada,
    );
    if (rasgos.length === 0) return;

    let oeste = Infinity,
      sur = Infinity,
      este = -Infinity,
      norte = -Infinity;
    for (const rasgo of rasgos) {
      if (rasgo.geometry.type !== "LineString") continue;
      for (const [lng, lat] of rasgo.geometry.coordinates as [number, number][]) {
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
  }, [listo, rutaResaltada, fuente, rellenoUtil]);

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
          console.error("[combiaje] mapa", e);
          setFalloEstilo(true);
        }}
        // Gestos pensados para una mano: nada de rotar sin querer.
        dragRotate={false}
        touchPitch={false}
        reuseMaps
      >
        {fuente.tipo === "vector" ? (
          <Source id="rutas" type="vector" url={fuente.url}>
            <Layer {...capaHalo({ colorHalo, resaltada: rutaResaltada, capaDeTesela: "routes" })} />
            <Layer
              {...capaRutas({ colorHalo, resaltada: rutaResaltada, capaDeTesela: "routes" })}
            />
            <Layer {...capaParadas({ colorHalo, capaDeTesela: "stops" })} />
            <Layer {...capaToque({ colorHalo, capaDeTesela: "routes" })} />
          </Source>
        ) : (
          <Source id="rutas" type="geojson" data={fuente.datos}>
            {/* Una fuente GeoJSON no lleva `source-layer`. */}
            <Layer {...capaHalo({ colorHalo, resaltada: rutaResaltada })} />
            <Layer {...capaRutas({ colorHalo, resaltada: rutaResaltada })} />
            <Layer {...capaToque({ colorHalo })} />
          </Source>
        )}

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
