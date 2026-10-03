import type { ReactNode } from "react";

import { BottomNav, SideRail } from "./main-nav";

/**
 * Carcasa de la aplicación.
 *
 * Regla dura: el documento NO hace scroll. `h-dvh` + `overflow-hidden` en el
 * contenedor y el scroll delegado al `<main>`. Si el body se puede desplazar,
 * el mapa a pantalla completa se rompe en iOS en cuanto el usuario arrastra
 * la hoja inferior.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Escritorio: riel vertical a la izquierda. */}
      <SideRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="contenido" className="relative min-h-0 flex-1">
          {children}
        </main>

        {/* Móvil: barra inferior, al alcance del pulgar. */}
        <BottomNav />
      </div>
    </div>
  );
}
