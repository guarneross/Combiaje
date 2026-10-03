"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const CICLO = ["system", "light", "dark"] as const;
type Tema = (typeof CICLO)[number];

const ETIQUETA: Record<Tema, string> = {
  system: "Tema del sistema",
  light: "Tema claro",
  dark: "Tema oscuro",
};

const sinSuscripcion = () => () => {};

/**
 * Detecta la hidratación sin `useEffect` + `setState`.
 *
 * El servidor no conoce la preferencia de tema del usuario, así que en el
 * primer render hay que dibujar un hueco. `useSyncExternalStore` con un
 * snapshot distinto en servidor y cliente es la forma que React 19 considera
 * correcta: cero renders en cascada y el compilador no se queja.
 */
function useHidratado() {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
}

/** Ciclo de tres estados en un solo botón: sistema → claro → oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const hidratado = useHidratado();

  if (!hidratado) {
    // Mismo tamaño que el botón, para no provocar un salto de layout.
    return <div className={className} aria-hidden="true" style={{ width: 44, height: 44 }} />;
  }

  const actual: Tema = CICLO.includes(theme as Tema) ? (theme as Tema) : "system";
  const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length]!;
  const Icono = actual === "light" ? Sun : actual === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(siguiente)}
      aria-label={`${ETIQUETA[actual]}. Cambiar a ${ETIQUETA[siguiente].toLowerCase()}`}
      title={ETIQUETA[actual]}
    >
      <Icono className="size-5" aria-hidden="true" />
    </Button>
  );
}
