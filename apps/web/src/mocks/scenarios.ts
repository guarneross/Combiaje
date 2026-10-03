/**
 * Escenarios de prueba de los mocks.
 *
 * Un mock que siempre responde rápido, lleno y correcto produce una
 * aplicación que se cae el primer día en producción. Estos escenarios existen
 * para poder construir —y ver con los ojos— los tres estados obligatorios.
 *
 * En el navegador se activan con un parámetro en la URL:
 *
 *   http://localhost:3000/?simular=vacio
 *   http://localhost:3000/?simular=error
 *   http://localhost:3000/?simular=lento
 *
 * En las pruebas, con `fijarEscenario("error")`.
 */

export const ESCENARIOS = ["normal", "vacio", "error", "lento"] as const;
export type Escenario = (typeof ESCENARIOS)[number];

let fijado: Escenario | null = null;

/** Para Vitest: fija el escenario sin depender de la URL. */
export function fijarEscenario(escenario: Escenario | null) {
  fijado = escenario;
}

export function escenarioActual(): Escenario {
  if (fijado) return fijado;
  if (typeof window === "undefined") return "normal";
  const valor = new URLSearchParams(window.location.search).get("simular");
  return (ESCENARIOS as readonly string[]).includes(valor ?? "") ? (valor as Escenario) : "normal";
}

/** Retraso que emula 4G lenta cuando el escenario lo pide. */
export function retrasoMs(): number {
  return escenarioActual() === "lento" ? 2500 : 120;
}
