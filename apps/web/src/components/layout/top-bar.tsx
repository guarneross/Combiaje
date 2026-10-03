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
}: {
  titulo: string;
  volverA?: string;
  acciones?: ReactNode;
  className?: string;
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

        <h1 className="min-w-0 flex-1 truncate px-1 text-base font-semibold tracking-tight">
          {titulo}
        </h1>

        {acciones}
        <ThemeToggle />
      </div>
    </header>
  );
}
