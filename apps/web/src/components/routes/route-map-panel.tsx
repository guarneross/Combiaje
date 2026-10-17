"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Maximize2, X } from "lucide-react";

import { CombiajeMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * El mapa de la ficha de ruta y del catálogo.
 *
 * Dos modos, según `slug`:
 *
 * - **Con slug (ficha de ruta):** esa ruta y nada más, con los dos sentidos.
 *   Es la única pantalla donde ida y vuelta juntas tienen sentido: ahí el
 *   recorrido completo *es* el tema, y el desfase las separa a cada lado de la
 *   calle para que no se tapen.
 * - **Sin slug (catálogo):** la red completa, solo el sentido de ida. Es la
 *   vista de «ver todo», que es a lo que alguien entra a propósito —y por eso
 *   ya no es lo que pasa al abrir la aplicación.
 *
 * Es cliente porque MapLibre lo es; se separa para que la ficha siga siendo un
 * componente de servidor y su contenido salga en el HTML inicial, que es lo
 * que la vuelve indexable.
 *
 * `soloDesdeLg` existe por una razón concreta: en el catálogo el mapa solo se
 * ve en escritorio, y esconderlo con `hidden lg:block` lo escondía pero no lo
 * desmontaba. Un teléfono acababa creando un contexto WebGL y descargando el
 * estilo y las teselas de un mapa que nadie iba a ver. Esto no lo monta.
 */
export function RouteMapPanel({
  slug,
  className,
  soloDesdeLg = false,
  expandible = false,
}: {
  /** Vacío significa «toda la red». */
  slug: string;
  className?: string;
  soloDesdeLg?: boolean;
  /**
   * Deja ampliar el mapa a pantalla completa. Es para el teléfono: en la
   * ficha el mapa cabe en una franja, y una franja no sirve para seguir un
   * recorrido de diez kilómetros.
   */
  expandible?: boolean;
}) {
  const esEscritorio = useEsEscritorio();
  const [ampliado, setAmpliado] = useState(false);

  // Escape cierra, como cualquier cosa que tape la pantalla.
  useEffect(() => {
    if (!ampliado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliado(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ampliado]);

  if (soloDesdeLg && !esEscritorio) return null;

  const unaRuta = slug.length > 0;

  return (
    <div
      className={cn(
        ampliado ? "bg-background fixed inset-0 z-50" : className,
        // En pantalla completa el mapa es la pantalla; no debe quedar debajo
        // de la barra de navegación del teléfono.
        ampliado && "pt-safe pb-safe",
      )}
    >
      <CombiajeMap
        rutasVisibles={unaRuta ? [slug] : null}
        rutaResaltada={unaRuta ? slug : null}
        sentido={unaRuta ? "ambos" : "principal"}
      >
        {expandible ? (
          <Button
            variant="secondary"
            size={ampliado ? "default" : "sm"}
            onClick={() => setAmpliado((previo) => !previo)}
            // Abajo a la derecha mientras es una franja —abajo a la izquierda
            // vive la escala—, y arriba a la izquierda en pantalla completa,
            // que es donde la mano espera el botón de cerrar.
            className={cn(
              "absolute z-10 shadow-md",
              ampliado ? "pt-safe top-3 left-3" : "right-3 bottom-3",
            )}
          >
            {ampliado ? (
              <>
                <X className="size-4" aria-hidden="true" />
                Cerrar
              </>
            ) : (
              <>
                <Maximize2 className="size-4" aria-hidden="true" />
                Ampliar mapa
              </>
            )}
          </Button>
        ) : null}
      </CombiajeMap>
    </div>
  );
}

/** El mismo punto de quiebre que `lg:` en Tailwind (64rem). */
const CONSULTA_ESCRITORIO = "(min-width: 64rem)";

function useEsEscritorio() {
  const suscribir = useCallback((avisar: () => void) => {
    const mq = window.matchMedia(CONSULTA_ESCRITORIO);
    mq.addEventListener("change", avisar);
    return () => mq.removeEventListener("change", avisar);
  }, []);

  // En servidor y en la primera pintada decimos «no es escritorio»: montar el
  // mapa de más tarde cuesta menos que montarlo de a gratis en un teléfono.
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => false,
  );
}
