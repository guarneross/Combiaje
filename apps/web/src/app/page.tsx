import { LocateFixed, Search } from "lucide-react";

import { MapSkeleton } from "@/components/feedback/skeletons";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAP_ATTRIBUTION, SITE_NAME } from "@/lib/constants";

/**
 * Pantalla principal. NO es un landing: es el mapa.
 *
 * Bloque 1: queda el armazón espacial correcto —mapa al fondo, controles
 * flotando encima, hoja inferior en el tercio del pulgar— con el mapa
 * sustituido por su esqueleto. El bloque 3 mete <CombiajeMap> y el bloque 4
 * hace vivir el buscador y "rutas cerca de mí".
 */
export default function MapaPage() {
  return (
    <div className="relative size-full overflow-hidden">
      {/* Capa del mapa. */}
      <div className="absolute inset-0">
        <MapSkeleton />
      </div>

      {/* Marca y tema: flotan arriba, sin barra que robe altura al mapa. */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        {/* En escritorio la marca ya vive en el riel lateral: no la repetimos. */}
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

      {/* Hoja inferior. En el bloque 4 se vuelve arrastrable. */}
      <section
        aria-label="Buscar rutas"
        className="bg-background pb-safe absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t shadow-[var(--map-overlay-shadow)] md:inset-y-0 md:right-auto md:w-[22rem] md:rounded-none md:border-t-0 md:border-r md:pt-4 md:shadow-none"
      >
        <div className="mx-auto w-full max-w-2xl space-y-3 p-4 md:max-w-none">
          {/* Asa de arrastre: solo tiene sentido en la hoja inferior móvil. */}
          <div
            aria-hidden="true"
            className="bg-border mx-auto h-1 w-10 rounded-full md:hidden"
            title="Arrastra para expandir"
          />

          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Busca una ruta o un destino"
              aria-label="Busca una ruta o un destino"
              className="pl-9"
              disabled
            />
          </div>

          <Button className="w-full" size="lg" disabled>
            <LocateFixed className="size-5" aria-hidden="true" />
            Rutas cerca de mí
          </Button>

          <p className="text-muted-foreground text-center text-xs">
            Andamiaje desplegado. El mapa entra en el bloque 3 y la búsqueda en el bloque 4.
          </p>

          <p
            className="text-muted-foreground/80 text-center text-[10px] leading-snug"
            dangerouslySetInnerHTML={{ __html: MAP_ATTRIBUTION }}
          />
        </div>
      </section>
    </div>
  );
}
