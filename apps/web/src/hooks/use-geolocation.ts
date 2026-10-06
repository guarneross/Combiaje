"use client";

import { useCallback, useState } from "react";

/**
 * Pide la ubicación del usuario, con estados explícitos para cada forma de
 * fallar.
 *
 * No la pide sola al cargar: el usuario toca el botón y entonces aparece el
 * permiso del navegador. Un diálogo de permiso que sale sin que nadie lo pida
 * se rechaza casi siempre, y un permiso rechazado es difícil de revertir.
 *
 * La coordenada **no se guarda en ningún lado**: vive en memoria mientras la
 * pantalla está abierta y se manda a `/nearby` para responder. Es el compromiso
 * de privacidad del proyecto y no es retórico.
 */

export type EstadoUbicacion =
  | { estado: "inactiva" }
  | { estado: "pidiendo" }
  | { estado: "lista"; lat: number; lng: number; precisionM: number }
  | { estado: "error"; motivo: MotivoFalla; mensaje: string };

export type MotivoFalla = "denegado" | "no-disponible" | "tiempo-agotado" | "sin-soporte";

const MENSAJES: Record<MotivoFalla, string> = {
  denegado:
    "No nos diste permiso de ubicación. Puedes activarlo desde el candado en la barra de direcciones, o buscar tu ruta por nombre.",
  "no-disponible":
    "Tu teléfono no pudo obtener la ubicación. Si estás bajo techo, sal un momento o prueba de nuevo.",
  "tiempo-agotado":
    "Tardó demasiado en encontrarte. Vuelve a intentar o busca tu ruta por nombre.",
  "sin-soporte": "Este navegador no puede darnos tu ubicación. Busca tu ruta por nombre.",
};

export function useGeolocation() {
  const [ubicacion, setUbicacion] = useState<EstadoUbicacion>({ estado: "inactiva" });

  /**
   * `alUbicar` se recibe aquí y no al crear el hook: guardar el callback en una
   * referencia obliga a escribirla durante el render, que es justo lo que las
   * reglas de React prohíben. Pasarlo por parámetro no tiene ese problema.
   */
  const pedir = useCallback((alUbicar?: () => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUbicacion({ estado: "error", motivo: "sin-soporte", mensaje: MENSAJES["sin-soporte"] });
      return;
    }

    setUbicacion({ estado: "pidiendo" });

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicacion({
          estado: "lista",
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
          precisionM: Math.round(posicion.coords.accuracy),
        });
        // Avisar aquí, y no desde un efecto que observe el estado: React
        // rechaza setState síncrono dentro de un efecto, y además esto es
        // exactamente lo que la regla sí permite — reaccionar a un sistema
        // externo desde su propia respuesta.
        alUbicar?.();
      },
      (error) => {
        const motivo: MotivoFalla =
          error.code === error.PERMISSION_DENIED
            ? "denegado"
            : error.code === error.TIMEOUT
              ? "tiempo-agotado"
              : "no-disponible";
        setUbicacion({ estado: "error", motivo, mensaje: MENSAJES[motivo] });
      },
      {
        enableHighAccuracy: true,
        // Diez segundos: más que eso y el usuario ya se cansó.
        timeout: 10_000,
        // Una lectura de hasta un minuto sirve; nadie camina tan rápido.
        maximumAge: 60_000,
      },
    );
  }, []);

  const limpiar = useCallback(() => setUbicacion({ estado: "inactiva" }), []);

  return { ubicacion, pedir, limpiar };
}
