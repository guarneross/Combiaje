"use client";

import { useCallback, useSyncExternalStore } from "react";

import { CombiajeMap } from "@/components/map";

/**
 * El mapa de la ficha de ruta y del catálogo, con su trazo resaltado.
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
}: {
  slug: string;
  className?: string;
  soloDesdeLg?: boolean;
}) {
  const esEscritorio = useEsEscritorio();
  if (soloDesdeLg && !esEscritorio) return null;

  return (
    <div className={className}>
      <CombiajeMap rutaResaltada={slug} />
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
