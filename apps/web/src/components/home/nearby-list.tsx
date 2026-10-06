"use client";

import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPinOff } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { RouteCard } from "@/components/routes/route-card";
import { Button } from "@/components/ui/button";
import type { EstadoUbicacion } from "@/hooks/use-geolocation";
import { ApiError, cercanasQuery } from "@/lib/api";

/**
 * «Rutas cerca de mí»: la razón de existir de la pantalla principal.
 *
 * Está partido en botón y resultados porque la hoja inferior tiene una
 * cabecera fija —que no se desplaza— y un cuerpo que sí. Meter una lista en la
 * cabecera la desborda; por eso el botón va arriba y los resultados abajo.
 */

export function NearbyButton({
  ubicacion,
  onPedir,
}: {
  ubicacion: EstadoUbicacion;
  onPedir: () => void;
}) {
  if (ubicacion.estado === "lista") return null;

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={onPedir}
      disabled={ubicacion.estado === "pidiendo"}
    >
      <LocateFixed
        className={ubicacion.estado === "pidiendo" ? "size-5 animate-pulse" : "size-5"}
        aria-hidden="true"
      />
      {ubicacion.estado === "pidiendo" ? "Buscando dónde estás…" : "Rutas cerca de mí"}
    </Button>
  );
}

export function NearbyResults({
  ubicacion,
  radio,
  onRadio,
  onPedir,
  onSeleccionar,
  rutaSeleccionada,
}: {
  ubicacion: EstadoUbicacion;
  radio: number;
  onRadio: (m: number) => void;
  onPedir: () => void;
  onSeleccionar: (slug: string) => void;
  rutaSeleccionada?: string | null;
}) {
  const lista = useQuery({
    ...cercanasQuery(
      ubicacion.estado === "lista"
        ? { lat: ubicacion.lat, lng: ubicacion.lng, radius: radio }
        : { lat: 0, lng: 0, radius: radio },
    ),
    enabled: ubicacion.estado === "lista",
  });

  if (ubicacion.estado === "inactiva" || ubicacion.estado === "pidiendo") return null;

  if (ubicacion.estado === "error") {
    return (
      <ErrorState
        titulo="No pudimos ubicarte"
        descripcion={ubicacion.mensaje}
        // Reintentar un permiso denegado no sirve de nada: hay que cambiarlo
        // en el navegador. En los demás casos sí vale la pena ofrecerlo.
        {...(ubicacion.motivo === "denegado" ? {} : { onReintentar: onPedir })}
        className="py-6"
      />
    );
  }

  if (lista.isPending) return <RouteListSkeleton cantidad={4} />;

  if (lista.error) {
    const api = lista.error instanceof ApiError ? lista.error : null;
    return (
      <ErrorState
        descripcion={api?.mensajeParaUsuario ?? "Revisa tu conexión y vuelve a intentar."}
        onReintentar={() => void lista.refetch()}
        className="py-6"
      />
    );
  }

  if (lista.data.routes.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        titulo={`No hay rutas a menos de ${radio} m`}
        descripcion="Puede que estés en una zona sin cobertura todavía, o que falte trazar las rutas de por aquí."
        className="py-6"
        accion={
          radio < 2000 ? (
            <Button variant="outline" onClick={() => onRadio(radio === 500 ? 1000 : 2000)}>
              Buscar a {radio === 500 ? "1 km" : "2 km"}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      <p className="text-muted-foreground px-1 pb-1 text-xs" role="status" aria-live="polite">
        {lista.data.routes.length}{" "}
        {lista.data.routes.length === 1 ? "ruta pasa" : "rutas pasan"} a menos de{" "}
        {lista.data.radiusM} m · precisión ±{ubicacion.precisionM} m
      </p>
      <ul className="divide-border/60 -mx-4 divide-y border-y">
        {lista.data.routes.map((ruta) => (
          <li key={ruta.id}>
            <RouteCard
              ruta={ruta}
              distanciaM={ruta.distanceM}
              como="boton"
              activa={rutaSeleccionada === ruta.slug}
              onClick={() => onSeleccionar(ruta.slug)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
