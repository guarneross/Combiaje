import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Estado vacío. Nunca se queda en "sin resultados": siempre propone la
 * siguiente acción, porque un callejón sin salida hace que el usuario cierre
 * la pestaña.
 */
export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icon?: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}
    >
      {Icon ? (
        <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        {descripcion ? (
          <p className="text-muted-foreground mx-auto max-w-xs text-sm">{descripcion}</p>
        ) : null}
      </div>
      {accion}
    </div>
  );
}
