"use client";

import { useQuery } from "@tanstack/react-query";

import type { EstadoUbicacion } from "@/hooks/use-geolocation";
import { planQuery } from "@/lib/api";

import type { Destino } from "./destino";

/**
 * El plan de viaje de la pantalla principal.
 *
 * Vive en un hook aparte porque dos cosas lo necesitan a la vez: la lista de
 * rutas recomendadas y el mapa, que tiene que dibujar exactamente esas y
 * ninguna más. Si cada una lo pidiera por su lado, podrían discrepar.
 *
 * El origen es la ubicación del usuario. No se pide sola: hasta que la
 * persona la da, no hay plan que calcular, y la pantalla lo dice en lugar de
 * mostrar una lista vacía.
 */
export function usePlanViaje(destino: Destino | null, ubicacion: EstadoUbicacion) {
  const hayDeDonde = ubicacion.estado === "lista";
  const activa = destino !== null && hayDeDonde;

  const origen = hayDeDonde ? { lat: ubicacion.lat, lng: ubicacion.lng } : { lat: 0, lng: 0 };

  return useQuery({
    ...planQuery({ origen, destino: destino ?? { lat: 0, lng: 0 } }),
    enabled: activa,
  });
}
