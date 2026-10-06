import { Suspense } from "react";

import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { TopBar } from "@/components/layout/top-bar";
import { RouteCatalog } from "@/components/routes/route-catalog";
import { RouteMapPanel } from "@/components/routes/route-map-panel";

export const metadata = {
  title: "Rutas",
  description:
    "Catálogo de rutas del transporte público de Puebla: número, destino, tarifa y recorrido.",
};

/**
 * Catálogo. En escritorio, lista a la izquierda y mapa a la derecha; en móvil,
 * solo la lista — el mapa ya tiene su pantalla y duplicarlo aquí gastaría
 * datos sin aportar nada.
 */
export default function RutasPage() {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col lg:max-w-md lg:border-r">
        <TopBar titulo="Rutas" />
        <div className="min-h-0 flex-1">
          {/* <RouteCatalog> lee `?q=` y `?concesionaria=` de la URL. Igual que
              en la pantalla principal, el límite va aquí y no en la raíz. */}
          <Suspense fallback={<RouteListSkeleton cantidad={8} className="p-4" />}>
            <RouteCatalog />
          </Suspense>
        </div>
      </div>

      {/* En móvil no se monta: `soloDesdeLg` no es `hidden`, es «no existe». */}
      <RouteMapPanel slug="" soloDesdeLg className="min-h-0 flex-1 lg:block" />
    </div>
  );
}
