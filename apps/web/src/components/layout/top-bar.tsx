import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";

/**
 * Barra superior de las pantallas que no son el mapa.
 *
 * La pantalla `/` NO la usa: ahí el mapa ocupa todo y los controles flotan
 * encima. Esta barra existe para el catálogo, la ficha de ruta y el perfil.
 */
export function TopBar({
  titulo,
  volverA,
  acciones,
  className,
  tituloComo: Titulo = "h1",
}: {
  titulo: string;
  volverA?: string;
  acciones?: ReactNode;
  className?: string;
  /**
   * Etiqueta del título de la barra. Por omisión `h1`, porque en la mayoría de
   * las pantallas la barra *es* el encabezado de la página. En la ficha de
   * ruta no: ahí el encabezado real es el nombre de la ruta, y dos `h1`
   * compiten entre sí para un lector de pantalla y para Google.
   */
  tituloComo?: "h1" | "p";
}) {
  return (
    <header
      className={cn(
        "bg-background/95 pt-safe border-border/80 sticky top-0 z-20 border-b backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-1 px-2 sm:px-4">
        {volverA ? (
          <Button variant="ghost" size="icon" asChild aria-label="Volver">
            <Link href={volverA}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span className="w-2" />
        )}

        <Titulo className="min-w-0 flex-1 truncate px-1 text-base font-semibold tracking-tight">
          {titulo}
        </Titulo>

        {acciones}
        <ThemeToggle />
      </div>
    </header>
  );
}
