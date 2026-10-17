"use client";

import { useCallback, useMemo, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { NEARBY_DEFAULT_RADIUS_M } from "@combiaje/shared";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CombiajeMap } from "@/components/map";
import { useGeolocation } from "@/hooks/use-geolocation";
import { env } from "@/lib/env";
import { MAP_ATTRIBUTION, SITE_NAME } from "@/lib/constants";

import { MINIMO_BUSQUEDA, PreguntaDestino, ResultadosBusqueda } from "./busqueda-destino";
import { destinoACadena, destinoDeCadena, type Destino } from "./destino";
import { HomeSheet, type Posicion } from "./home-sheet";
import { NearbyButton, NearbyResults } from "./nearby-list";
import { PlanRutas, slugsDelPlan } from "./plan-rutas";
import { usePlanViaje } from "./use-plan-viaje";

/**
 * La pantalla principal.
 *
 * Es una pregunta, no un mapa de todo. «¿A dónde quieres ir?» arriba, el mapa
 * limpio detrás, y los trazos aparecen como **respuesta**: las rutas que te
 * llevan a donde dijiste, o la que escogiste de la lista.
 *
 * Antes abría dibujando el catálogo completo, ida y vuelta de cada ruta. Con
 * dos rutas trazadas ya era un nudo encima del centro y no decía nada; con
 * diez habría sido ilegible. La red completa sigue existiendo, pero en el
 * catálogo (`/rutas`), que es donde alguien va cuando quiere ver todo.
 *
 * El estado que define **lo que el usuario está viendo** vive en la URL: el
 * destino, la ruta resaltada y el texto buscado. Así un enlace abre exactamente
 * la misma pantalla, que es la regla del proyecto. Lo que no va en la URL es la
 * posición de la hoja ni el radio de búsqueda: son presentación, y ensuciarían
 * el enlace sin aportarle nada a quien lo recibe.
 */

/**
 * Lo que esta pantalla tapa: arriba la marca y el cambio de tema; abajo, la
 * hoja en su posición media. Si el mapa es más bajo que esto (no pasa aquí,
 * pero sí en pantallas chicas apaisadas), el propio mapa lo recorta.
 */
const RELLENO_PANTALLA = { top: 72, bottom: 280, left: 32, right: 32 };

export function PantallaMapa() {
  const [{ ruta, q, d, dn }, setConsulta] = useQueryStates(
    {
      ruta: parseAsString,
      q: parseAsString.withDefault(""),
      d: parseAsString,
      dn: parseAsString,
    },
    { history: "replace", shallow: true },
  );

  // La hoja abre en media: la pregunta tiene que verse sin que nadie la
  // arrastre, porque es lo único que hay que hacer al llegar.
  const [posicion, setPosicion] = useState<Posicion>("media");
  const [radio, setRadio] = useState(NEARBY_DEFAULT_RADIUS_M);
  const { ubicacion, pedir } = useGeolocation();

  const destino = useMemo(() => destinoDeCadena(d, dn), [d, dn]);
  const plan = usePlanViaje(destino, ubicacion);

  const buscando = q.trim().length >= MINIMO_BUSQUEDA;

  /**
   * Lo que el mapa dibuja.
   *
   * Con destino, las rutas del plan —todas, para que se vean las alternativas,
   * cada una desfasada a su lado de la calle—. Sin destino, solo la que la
   * persona escogió. Y al abrir, nada.
   */
  const slugsDelViaje = useMemo(() => slugsDelPlan(plan.data), [plan.data]);
  const rutasVisibles = useMemo(() => {
    if (destino) return slugsDelViaje;
    return ruta ? [ruta] : [];
  }, [destino, slugsDelViaje, ruta]);

  const ubicarme = useCallback(() => pedir(() => setPosicion("media")), [pedir]);

  const elegirLugar = useCallback(
    (nuevo: Destino) => {
      void setConsulta({ d: destinoACadena(nuevo), dn: nuevo.nombre, q: null, ruta: null });
      setPosicion("media");
      // Si todavía no sabemos de dónde sale, el plan no se puede calcular:
      // mejor pedir la ubicación en el mismo gesto que eligió el destino.
      if (ubicacion.estado === "inactiva") ubicarme();
    },
    [setConsulta, ubicacion.estado, ubicarme],
  );

  const quitarDestino = useCallback(() => {
    void setConsulta({ d: null, dn: null, ruta: null });
  }, [setConsulta]);

  const seleccionar = useCallback(
    (slug: string) => {
      // Tocar una ruta ya seleccionada la quita: es lo que espera la gente.
      void setConsulta({ ruta: ruta === slug ? null : slug });
      // Y se baja la hoja, porque lo que el usuario quiere ver ahora es el mapa.
      setPosicion("colapsada");
    },
    [ruta, setConsulta],
  );

  return (
    <div className="relative size-full overflow-hidden">
      <div className="absolute inset-0">
        <CombiajeMap
          rutasVisibles={rutasVisibles}
          rutaResaltada={ruta}
          onSeleccionarRuta={seleccionar}
          marcaDestino={destino}
          centrarEn={
            ubicacion.estado === "lista" ? { lat: ubicacion.lat, lng: ubicacion.lng } : null
          }
          // Lo que esta pantalla tapa con sus propias cosas: la barra de
          // arriba y la hoja de abajo. El mapa no tiene por qué saberlo solo.
          relleno={RELLENO_PANTALLA}
        />
      </div>

      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <span className="bg-background/90 pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-semibold shadow-sm backdrop-blur-sm md:hidden">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-full text-xs font-bold"
          >
            C
          </span>
          {SITE_NAME}
        </span>
        <span className="bg-background/90 pointer-events-auto rounded-full shadow-sm backdrop-blur-sm">
          <ThemeToggle />
        </span>
      </div>

      <HomeSheet
        posicion={posicion}
        onPosicion={setPosicion}
        cabecera={
          <div className="space-y-3">
            <PreguntaDestino
              texto={q}
              onTexto={(valor) => {
                void setConsulta({ q: valor || null });
                if (valor.trim().length >= MINIMO_BUSQUEDA) setPosicion("media");
              }}
              destino={destino}
              onQuitarDestino={quitarDestino}
            />
            {/* Mientras se busca o ya hay destino, el botón de ubicación estorba. */}
            {!buscando && !destino ? (
              <NearbyButton ubicacion={ubicacion} onPedir={ubicarme} />
            ) : null}
          </div>
        }
      >
        {destino ? (
          <PlanRutas
            destino={destino}
            ubicacion={ubicacion}
            consulta={plan}
            onPedirUbicacion={ubicarme}
            onSeleccionar={seleccionar}
            rutaSeleccionada={ruta}
            onVerCercanas={quitarDestino}
          />
        ) : buscando ? (
          <ResultadosBusqueda
            texto={q}
            onElegirLugar={elegirLugar}
            onElegirRuta={seleccionar}
            rutaSeleccionada={ruta}
          />
        ) : (
          <NearbyResults
            ubicacion={ubicacion}
            radio={radio}
            onRadio={setRadio}
            onPedir={ubicarme}
            onSeleccionar={seleccionar}
            rutaSeleccionada={ruta}
          />
        )}

        {env.NEXT_PUBLIC_ENABLE_MOCKS ? (
          <p className="bg-muted text-muted-foreground mt-3 rounded-md px-3 py-2 text-center text-xs">
            <strong className="text-foreground font-medium">Datos en construcción.</strong> Los
            trazos están dibujados a mano y aún no se verifican en campo.
          </p>
        ) : null}

        <p
          className="text-muted-foreground/80 mt-3 pb-2 text-center text-[10px] leading-snug"
          dangerouslySetInnerHTML={{ __html: MAP_ATTRIBUTION }}
        />
      </HomeSheet>
    </div>
  );
}
