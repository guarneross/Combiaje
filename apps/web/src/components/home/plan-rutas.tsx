"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { BusLeg, TripOption, TripPlanResponse } from "@combiaje/shared";
import { ArrowRight, Footprints, LocateFixed, RouteOff } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import type { EstadoUbicacion } from "@/hooks/use-geolocation";
import { ApiError } from "@/lib/api";
import { cn, formatDistance } from "@/lib/utils";

import type { Destino } from "./destino";

/**
 * «Te sirven estas rutas».
 *
 * La respuesta a la pregunta de la pantalla. Cada opción es una ruta y **un
 * sentido**: el que de verdad te lleva. Antes el planificador proponía la ida
 * y la vuelta de la misma ruta como si fueran dos opciones, y una de las dos
 * te dejaba en el lado contrario de la ciudad.
 *
 * Lo que se dice de cada opción son metros, no minutos: no hay frecuencias ni
 * velocidades medidas, y un «15 min» inventado es peor que no decir nada.
 */

/** Por debajo de esto, la caminata no vale la pena mencionarla. */
const CAMINATA_DESPRECIABLE_M = 50;

/** El tramo de camión de una opción. Hoy siempre hay exactamente uno. */
export function tramoDeCamion(opcion: TripOption): BusLeg | null {
  return (opcion.legs.find((tramo) => tramo.mode === "bus") as BusLeg | undefined) ?? null;
}

/** Los slugs que la pantalla tiene que dibujar en el mapa, en orden. */
export function slugsDelPlan(plan: TripPlanResponse | undefined): string[] {
  if (!plan) return [];
  const slugs: string[] = [];
  for (const opcion of plan.options) {
    const camion = tramoDeCamion(opcion);
    if (camion && !slugs.includes(camion.routeSlug)) slugs.push(camion.routeSlug);
  }
  return slugs;
}

export function PlanRutas({
  destino,
  ubicacion,
  consulta,
  onPedirUbicacion,
  onSeleccionar,
  rutaSeleccionada,
  onVerCercanas,
}: {
  destino: Destino;
  ubicacion: EstadoUbicacion;
  consulta: UseQueryResult<TripPlanResponse>;
  onPedirUbicacion: () => void;
  onSeleccionar: (slug: string) => void;
  rutaSeleccionada?: string | null;
  onVerCercanas: () => void;
}) {
  // Sin saber de dónde sales no hay nada que calcular, y vale más decirlo que
  // enseñar una lista vacía.
  if (ubicacion.estado !== "lista") {
    return (
      <div className="space-y-3 py-4">
        <p className="text-muted-foreground text-sm">
          Para decirte qué camión te lleva a <strong className="text-foreground">{destino.nombre}</strong>{" "}
          necesitamos saber de dónde sales.
        </p>
        <Button className="w-full" size="lg" onClick={onPedirUbicacion}>
          <LocateFixed
            className={cn("size-5", ubicacion.estado === "pidiendo" && "animate-pulse")}
            aria-hidden="true"
          />
          {ubicacion.estado === "pidiendo" ? "Buscando dónde estás…" : "Usar mi ubicación"}
        </Button>
        {ubicacion.estado === "error" ? (
          <p className="text-muted-foreground text-xs">{ubicacion.mensaje}</p>
        ) : null}
      </div>
    );
  }

  if (consulta.isPending) return <RouteListSkeleton cantidad={3} />;

  if (consulta.error) {
    return (
      <ErrorState
        descripcion={
          consulta.error instanceof ApiError
            ? consulta.error.mensajeParaUsuario
            : "Revisa tu conexión y vuelve a intentar."
        }
        onReintentar={() => void consulta.refetch()}
        className="py-6"
      />
    );
  }

  if (consulta.data.options.length === 0) {
    return (
      <EmptyState
        icon={RouteOff}
        titulo="Ninguna ruta trazada te lleva ahí"
        descripcion={`De las rutas que ya tenemos en el mapa, ninguna pasa cerca de ti y de ${destino.nombre} en el mismo sentido. Faltan rutas por trazar: puede que sí exista y todavía no esté aquí.`}
        className="py-6"
        accion={
          <Button variant="outline" onClick={onVerCercanas}>
            Ver qué pasa cerca de mí
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <p className="text-muted-foreground px-1 pb-1 text-xs" role="status" aria-live="polite">
        {consulta.data.options.length === 1
          ? "Una ruta te lleva"
          : `${consulta.data.options.length} rutas te llevan`}{" "}
        · caminas hasta {formatDistance(consulta.data.meta.maxWalkM)}
      </p>

      <ul className="divide-border/60 -mx-4 divide-y border-y">
        {consulta.data.options.map((opcion) => {
          const camion = tramoDeCamion(opcion);
          if (!camion) return null;
          const activa = rutaSeleccionada === camion.routeSlug;

          return (
            <li key={`${camion.variantId}`}>
              <button
                type="button"
                onClick={() => onSeleccionar(camion.routeSlug)}
                aria-pressed={activa}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  activa ? "bg-accent" : "hover:bg-accent/60 focus-visible:bg-accent/60",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1.5 text-sm font-bold text-white"
                    style={{ backgroundColor: camion.color }}
                  >
                    {camion.routeShortName}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{camion.boardAt.name}</span>
                      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{camion.alightAt.name}</span>
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      sentido {camion.variantName.toLowerCase()} ·{" "}
                      {formatDistance(camion.onboardDistanceM)} a bordo
                    </span>
                  </span>
                </span>

                <span className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
                  <Footprints className="size-3.5 shrink-0" aria-hidden="true" />
                  {/* «Caminas 0 m» no es una frase que diga nadie. */}
                  {opcion.totalWalkM < CAMINATA_DESPRECIABLE_M
                    ? "Te deja prácticamente enfrente"
                    : `Caminas ${formatDistance(opcion.totalWalkM)} en total`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
