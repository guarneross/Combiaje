"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de error con reintento. El mensaje técnico va en `detalle` y solo se
 * muestra en desarrollo: al usuario en la calle no le sirve un stack trace,
 * le sirve un botón.
 */
export function ErrorState({
  titulo = "No pudimos cargar esto",
  descripcion = "Revisa tu conexión y vuelve a intentar.",
  detalle,
  onReintentar,
  className,
}: {
  titulo?: string;
  descripcion?: string;
  detalle?: string;
  onReintentar?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}
    >
      <span className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>

      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm">{descripcion}</p>
      </div>

      {onReintentar ? (
        <Button variant="outline" onClick={onReintentar}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      ) : null}

      {detalle && process.env.NODE_ENV === "development" ? (
        <pre className="bg-muted text-muted-foreground max-w-full overflow-x-auto rounded-md p-2 text-left text-[11px]">
          {detalle}
        </pre>
      ) : null}
    </div>
  );
}
