"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

/**
 * Política de caché y reintentos, pensada para alguien parado en la calle con
 * datos móviles contados.
 */
function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Un minuto de frescura por omisión; cada consulta lo ajusta según
        // qué tan seguido cambia de verdad su dato.
        staleTime: 60_000,
        gcTime: 10 * 60_000,

        // Reintentar un 404 no lo convierte en 200. Solo insistimos cuando
        // puede servir de algo: red caída, tiempo agotado, 5xx, 429.
        //
        // Un solo reintento, y rápido. Medido: con dos reintentos y espera
        // exponencial de hasta 8 s, el usuario se queda ocho segundos mirando
        // un esqueleto antes de enterarse de que algo falló. Es mejor fallar
        // pronto y darle el botón de reintentar: él decide si insiste.
        retry: (intentos, error) => {
          if (error instanceof ApiError) return error.esReintentable && intentos < 1;
          return false;
        },
        retryDelay: (intento) => Math.min(800 * 2 ** intento, 3000),

        // Volver a pedir cada vez que la pestaña recupera el foco gasta datos
        // del usuario sin pedirle permiso. Apagado a propósito.
        refetchOnWindowFocus: false,

        // Esto sí: cuando vuelve la conexión, recuperar lo que falló.
        refetchOnReconnect: true,

        // El esqueleto solo tiene sentido si de verdad no hay nada que pintar.
        placeholderData: undefined,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let clienteDelNavegador: QueryClient | undefined;

function obtenerQueryClient() {
  // En el servidor, un cliente nuevo por petición: compartirlo filtraría
  // datos de un usuario a otro.
  if (typeof window === "undefined") return crearQueryClient();
  // En el navegador, uno solo para toda la sesión, para que la caché
  // sobreviva a la navegación entre pantallas.
  clienteDelNavegador ??= crearQueryClient();
  return clienteDelNavegador;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [cliente] = useState(obtenerQueryClient);
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
