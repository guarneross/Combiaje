import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderBase, type RenderOptions } from "@testing-library/react";

/**
 * Render con los proveedores que la aplicación tiene de verdad.
 *
 * El cliente de consultas se crea **uno por prueba**: compartirlo haría que la
 * caché de una prueba contestara la siguiente, y entonces una prueba del
 * estado de error pasaría solo porque otra ya había traído datos.
 *
 * Y `retry: false`: en producción reintentamos una vez, pero en una prueba eso
 * solo agrega 800 ms de espera antes de ver el error que estamos buscando.
 */
export function crearCliente() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function render(ui: ReactElement, opciones?: Omit<RenderOptions, "wrapper">) {
  const cliente = crearCliente();
  function Proveedores({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  }
  return { cliente, ...renderBase(ui, { wrapper: Proveedores, ...opciones }) };
}

export * from "@testing-library/react";
