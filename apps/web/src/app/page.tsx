import { Suspense } from "react";

import { PantallaMapa } from "@/components/home/pantalla-mapa";

/**
 * Pantalla principal. NO es un landing: es el mapa.
 *
 * Todo lo interactivo vive en <PantallaMapa>, que es de cliente porque
 * necesita el mapa, la geolocalización y el estado de la URL. Esta página se
 * queda de servidor para que la metadata y el primer HTML salgan sin esperar a
 * JavaScript.
 *
 * El <Suspense> es obligatorio: <PantallaMapa> lee la URL con nuqs, y eso
 * usa `useSearchParams()`, que al prerenderizar necesita un límite donde
 * esperar. Antes esto lo resolvía un `loading.tsx` en la raíz, pero un
 * límite en la raíz obliga a Next a mandar el HTML (y el status 200) antes
 * de saber si la página existe, y entonces `/rutas/<ruta-que-no-existe>`
 * respondía 200 en lugar de 404. El límite va donde de verdad hace falta.
 */
export default function MapaPage() {
  return (
    <Suspense>
      <PantallaMapa />
    </Suspense>
  );
}
