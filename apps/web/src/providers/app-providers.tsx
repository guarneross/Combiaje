"use client";

import type { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Punto único de composición de proveedores de cliente.
 *
 * MSW no va aquí: se monta más abajo, envolviendo solo el contenido de la
 * página (ver `app/layout.tsx`), para que la carcasa y la navegación se
 * pinten de inmediato aunque el worker tarde en arrancar.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="combiaje-tema"
    >
      <NuqsAdapter>
        <QueryProvider>{children}</QueryProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
