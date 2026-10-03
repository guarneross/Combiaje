import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Distancia legible para alguien parado en la calle.
 * Abajo de 1 km, en metros redondeados a 10. Arriba, en kilómetros con un
 * decimal. Nadie necesita saber que son 1 347 metros.
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace(".0", "")} km`;
}

/** Minutos a pie, a 1.25 m/s (paso urbano real, no de laboratorio). */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1.25 / 60));
}

/** Tarifa en centavos a pesos mexicanos. 950 → "$9.50" */
export function formatFare(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
