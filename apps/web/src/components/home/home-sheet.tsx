"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Hoja inferior arrastrable: el patrón principal de la pantalla en móvil.
 *
 * Tres posiciones. Colapsada deja ver el mapa casi completo y solo el buscador
 * y el botón; media muestra resultados sin perder el mapa de vista; completa es
 * para recorrer una lista larga.
 *
 * Se arrastra moviendo el `transform` directamente sobre el nodo, sin pasar por
 * el estado de React: un `setState` por cada evento de movimiento produce
 * decenas de renders por segundo y se siente pegajoso justo en el gesto donde
 * más se nota.
 *
 * En escritorio deja de ser hoja y se vuelve panel lateral fijo, así que el
 * arrastre se desactiva.
 */

type Posicion = "colapsada" | "media" | "completa";

/** Qué tanto se baja la hoja en cada posición, sobre una altura total de 85dvh. */
const DESPLAZAMIENTO: Record<Posicion, string> = {
  colapsada: "calc(85dvh - var(--asomo))",
  media: "calc(85dvh - 50dvh)",
  completa: "0px",
};

const ORDEN: Posicion[] = ["colapsada", "media", "completa"];

export function HomeSheet({
  cabecera,
  children,
  posicion,
  onPosicion,
}: {
  /** Siempre visible: buscador y botón de «cerca de mí». */
  cabecera: ReactNode;
  /** Resultados, visibles al expandir. */
  children: ReactNode;
  posicion: Posicion;
  onPosicion: (p: Posicion) => void;
}) {
  const hoja = useRef<HTMLElement>(null);
  const inicioY = useRef<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const alBajar = useCallback((e: React.PointerEvent) => {
    inicioY.current = e.clientY;
    setArrastrando(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const alMover = useCallback((e: React.PointerEvent) => {
    if (inicioY.current === null || !hoja.current) return;
    const delta = e.clientY - inicioY.current;
    hoja.current.style.setProperty("--arrastre", `${delta}px`);
  }, []);

  const alSoltar = useCallback(
    (e: React.PointerEvent) => {
      if (inicioY.current === null) return;
      const delta = e.clientY - inicioY.current;
      inicioY.current = null;
      setArrastrando(false);
      hoja.current?.style.removeProperty("--arrastre");

      // Más de 60 px decide el gesto; menos es un toque y solo avanza una
      // posición, que es lo que la gente espera al picar el asa.
      const indice = ORDEN.indexOf(posicion);
      if (Math.abs(delta) < 8) {
        onPosicion(ORDEN[Math.min(indice + 1, ORDEN.length - 1)]!);
      } else if (delta < -60) {
        onPosicion(ORDEN[Math.min(indice + 1, ORDEN.length - 1)]!);
      } else if (delta > 60) {
        onPosicion(ORDEN[Math.max(indice - 1, 0)]!);
      }
    },
    [posicion, onPosicion],
  );

  return (
    <section
      ref={hoja}
      aria-label="Buscar rutas"
      style={
        {
          "--asomo": "13.5rem",
          height: "85dvh",
          transform: `translateY(calc(${DESPLAZAMIENTO[posicion]} + var(--arrastre, 0px)))`,
          boxShadow: "var(--map-overlay-shadow)",
        } as React.CSSProperties
      }
      className={cn(
        "bg-background absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t",
        !arrastrando && "transition-transform duration-300 ease-out",
        // En escritorio: panel lateral fijo, sin arrastre ni transform.
        "md:inset-y-0 md:right-auto md:h-full md:w-[22rem] md:translate-y-0 md:rounded-none md:border-t-0 md:border-r md:shadow-none",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Hoja de búsqueda, posición ${posicion}. Arrastra o usa las flechas para cambiarla.`}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={(e) => {
          const i = ORDEN.indexOf(posicion);
          if (e.key === "ArrowUp") onPosicion(ORDEN[Math.min(i + 1, 2)]!);
          if (e.key === "ArrowDown") onPosicion(ORDEN[Math.max(i - 1, 0)]!);
        }}
        className="flex shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing md:hidden"
      >
        <span aria-hidden="true" className="bg-border h-1 w-10 rounded-full" />
      </div>

      <div className="shrink-0 px-4 pb-3 md:pt-4">{cabecera}</div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {children}
      </div>
    </section>
  );
}

export type { Posicion };
