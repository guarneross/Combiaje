"use client";

import { useQuery } from "@tanstack/react-query";
import {
  GEOCODE_MIN_LENGTH,
  PLACE_KIND_LABEL,
  type Place,
  type PlaceKind,
} from "@combiaje/shared";
import { Bus, MapPin, Search, SearchX, Signpost, Store, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { RouteListSkeleton } from "@/components/feedback/skeletons";
import { RouteCard } from "@/components/routes/route-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { lugaresQuery, rutasQuery } from "@/lib/api";

import type { Destino } from "./destino";

/**
 * «¿A dónde quieres ir?»
 *
 * Es lo primero y lo más grande de la pantalla, y es deliberado: la pregunta
 * que trae a alguien a Combiaje no es «enséñame todas las rutas de Puebla»,
 * es «cómo llego». El mapa abre limpio y se llena como respuesta.
 *
 * El mismo cuadro busca lugares y rutas, sin que haya que elegir pestaña
 * antes de escribir: quien pone «Zócalo» quiere llegar ahí, quien pone «21»
 * quiere ver esa ruta, y la aplicación puede distinguirlo sola.
 */

/** Dos letras: con una sola, cualquier texto devuelve media ciudad. */
export const MINIMO_BUSQUEDA = 2;

export function PreguntaDestino({
  texto,
  onTexto,
  destino,
  onQuitarDestino,
}: {
  texto: string;
  onTexto: (valor: string) => void;
  destino: Destino | null;
  onQuitarDestino: () => void;
}) {
  if (destino) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Vas a</p>
        <div className="bg-accent flex items-center gap-2 rounded-lg px-3 py-2">
          <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-semibold">{destino.nombre}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onQuitarDestino}
            aria-label="Cambiar de destino"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl leading-tight font-semibold tracking-tight">¿A dónde quieres ir?</h1>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Una calle, una colonia, o el número de la ruta"
          aria-label="Escribe a dónde quieres ir, o el número de una ruta"
          className="h-11 pl-9 text-base"
          enterKeyHint="search"
        />
      </div>
    </div>
  );
}

const ICONO: Record<PlaceKind, LucideIcon> = {
  stop: Bus,
  neighborhood: MapPin,
  street: Signpost,
  poi: Store,
  locality: MapPin,
  other: MapPin,
};

function FilaLugar({ lugar, onElegir }: { lugar: Place; onElegir: () => void }) {
  const Icono = ICONO[lugar.kind];

  return (
    <button
      type="button"
      onClick={onElegir}
      className="hover:bg-accent/60 focus-visible:bg-accent/60 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full">
        <Icono className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{lugar.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {lugar.context ?? PLACE_KIND_LABEL[lugar.kind]}
        </span>
      </span>
    </button>
  );
}

/**
 * Resultados de lo que se escribió: primero los lugares —que es lo que
 * contesta la pregunta— y debajo las rutas que coinciden por número o nombre.
 *
 * Los lugares salen de `GET /geocode`, que junta las paradas propias con
 * OpenStreetMap a través de Photon. Dos cosas que importan:
 *
 * - **Antirrebote de 350 ms.** Sin él, escribir «angelópolis» son once
 *   consultas al geocodificador. Detrás hay un servicio gratuito ajeno.
 * - **Tres letras para los lugares**, dos para las rutas. Una ruta se busca
 *   por su número («21»); una colonia, no.
 */
export function ResultadosBusqueda({
  texto,
  onElegirLugar,
  onElegirRuta,
  rutaSeleccionada,
}: {
  texto: string;
  onElegirLugar: (destino: Destino) => void;
  onElegirRuta: (slug: string) => void;
  rutaSeleccionada?: string | null;
}) {
  const consulta = texto.trim();
  const activa = consulta.length >= MINIMO_BUSQUEDA;

  // El texto se ve al instante; lo que espera es la consulta.
  const conRetraso = useDebounce(consulta);
  const buscarLugares = conRetraso.length >= GEOCODE_MIN_LENGTH;

  const lugares = useQuery({ ...lugaresQuery(conRetraso), enabled: buscarLugares });
  const rutas = useQuery({
    ...rutasQuery({ q: conRetraso, limit: 20 }),
    enabled: conRetraso.length >= MINIMO_BUSQUEDA,
  });

  if (!activa) return null;
  if (rutas.isPending || (buscarLugares && lugares.isPending)) {
    return <RouteListSkeleton cantidad={3} />;
  }

  const encontrados = lugares.data?.results ?? [];
  const hayRutas = (rutas.data?.items.length ?? 0) > 0;

  if (encontrados.length === 0 && !hayRutas) {
    return (
      <EmptyState
        icon={SearchX}
        titulo={`Nada con «${consulta}»`}
        descripcion={
          consulta.length < GEOCODE_MIN_LENGTH
            ? `Escribe al menos ${GEOCODE_MIN_LENGTH} letras para buscar un lugar, o el número del parabrisas para buscar una ruta.`
            : "Prueba con el nombre de la colonia, con una calle, o con el número del parabrisas."
        }
        className="py-6"
      />
    );
  }

  return (
    <div className="space-y-4">
      {encontrados.length > 0 ? (
        <section>
          <h2 className="text-muted-foreground px-1 pb-1 text-xs font-medium">Lugares</h2>
          <ul className="divide-border/60 -mx-4 divide-y border-y">
            {encontrados.map((lugar) => (
              <li key={lugar.id}>
                <FilaLugar
                  lugar={lugar}
                  onElegir={() =>
                    onElegirLugar({ lat: lugar.lat, lng: lugar.lng, nombre: lugar.name })
                  }
                />
              </li>
            ))}
          </ul>
          {/* Honestidad cuando el buscador externo no contestó: lo que hay son
              nuestras paradas, y no es que no exista nada más. */}
          {lugares.data?.partial ? (
            <p className="text-muted-foreground px-1 pt-1.5 text-xs">
              El buscador de calles no respondió. Por ahora solo salen los lugares que Combiaje
              conoce.
            </p>
          ) : null}
        </section>
      ) : null}

      {hayRutas ? (
        <section>
          <h2 className="text-muted-foreground px-1 pb-1 text-xs font-medium">Rutas</h2>
          <ul className="divide-border/60 -mx-4 divide-y border-y">
            {rutas.data!.items.map((ruta) => (
              <li key={ruta.id}>
                <RouteCard
                  ruta={ruta}
                  como="boton"
                  activa={rutaSeleccionada === ruta.slug}
                  onClick={() => onElegirRuta(ruta.slug)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
