import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftRight, Bus, Ruler, Ticket } from "lucide-react";

import { TopBar } from "@/components/layout/top-bar";
import { RouteDenominations } from "@/components/routes/route-denominations";
import { RouteMapPanel } from "@/components/routes/route-map-panel";
import { RouteRatingsSummary } from "@/components/routes/route-ratings-summary";
import { Badge } from "@/components/ui/badge";
import { ApiError, obtenerRuta } from "@/lib/api";
import { SITE_DESCRIPTION } from "@/lib/constants";
import { formatDistance, formatFare } from "@/lib/utils";

/**
 * Ficha de ruta, **renderizada en servidor**.
 *
 * Es la página que tiene que aparecer cuando alguien busca «ruta 21 Puebla» en
 * Google, así que su contenido sale en el HTML inicial y no detrás de
 * JavaScript. Lo único de cliente es el mapa.
 */

async function cargarRuta(slug: string) {
  try {
    return await obtenerRuta(slug);
  } catch (error) {
    // Un 404 es una ruta que no existe; cualquier otra cosa es un fallo real
    // y conviene que se vea como tal en vez de disfrazarse de «no encontrado».
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ruta = await cargarRuta(slug).catch(() => null);
  if (!ruta) return { title: "Ruta no encontrada" };

  const anterior = ruta.denominations.find((d) => !d.current)?.shortName;
  const titulo = `Ruta ${ruta.shortName} · ${ruta.longName}`;

  return {
    title: titulo,
    description:
      `Recorrido, tarifa y calificaciones de la ruta ${ruta.shortName} ${ruta.longName} del ` +
      `transporte público de Puebla.` +
      (anterior ? ` Antes conocida como ${anterior}.` : ` ${SITE_DESCRIPTION}`),
    openGraph: { title: titulo, type: "article" },
    alternates: { canonical: `/rutas/${ruta.slug}` },
  };
}

export default async function RutaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ruta = await cargarRuta(slug);
  if (!ruta) notFound();

  const tarifa = formatFare(ruta.fareCents);
  const anterior = ruta.denominations.find((d) => !d.current)?.shortName;
  const principal = ruta.variants.find((v) => v.isPrimary) ?? ruta.variants[0];

  return (
    // Un solo mapa, colocado por CSS.
    //
    // La versión anterior ponía dos <RouteMapPanel>, uno `lg:hidden` y otro
    // `hidden lg:block`. `display:none` esconde pero no desmonta: eran dos
    // instancias de MapLibre, dos contextos WebGL y dos descargas del estilo
    // en un teléfono. Ahora es un solo mapa y la rejilla lo manda a la
    // columna derecha en escritorio.
    <div className="flex h-full flex-col lg:grid lg:grid-cols-[minmax(0,24rem)_1fr] lg:grid-rows-[auto_minmax(0,1fr)]">
      <TopBar
        titulo={`Ruta ${ruta.shortName}`}
        volverA="/rutas"
        tituloComo="p"
        className="lg:col-start-1 lg:row-start-1"
      />

      {/* En móvil, fijo bajo la barra: es lo que se vino a ver, y no se va
          con el scroll. En escritorio ocupa toda la columna derecha. */}
      <RouteMapPanel
        slug={ruta.slug}
        className="h-52 w-full shrink-0 border-b lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:border-b-0 lg:border-l"
      />

      <div className="min-h-0 flex-1 overflow-y-auto lg:col-start-1 lg:row-start-2">
        {/* Identidad: lo que la gente reconoce. */}
        <header className="flex items-start gap-3 p-4">
          <span
            className="grid h-14 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-xl font-bold text-white"
            style={{
              background: ruta.colorSecondary
                ? `linear-gradient(135deg, ${ruta.color} 50%, ${ruta.colorSecondary} 50%)`
                : ruta.color,
            }}
          >
            {ruta.shortName}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-lg font-semibold leading-tight">{ruta.longName}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {anterior ? <Badge variant="secondary">antes {anterior}</Badge> : null}
              {ruta.status === "draft" ? (
                <Badge variant="outline" title="Trazo dibujado a mano, sin verificar en campo">
                  Sin verificar
                </Badge>
              ) : null}
              {ruta.agency ? (
                <span className="text-muted-foreground text-xs">
                  {ruta.agency.shortName ?? ruta.agency.name}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <dl className="divide-border/60 grid grid-cols-2 divide-x border-b">
          <Dato icono={Ticket} etiqueta="Tarifa" valor={tarifa ?? "Por confirmar"} />
          <Dato
            icono={Ruler}
            etiqueta="Longitud"
            valor={principal ? formatDistance(principal.lengthM) : "—"}
          />
        </dl>

        <div className="space-y-6 p-4">
          <section className="space-y-2" aria-labelledby="variantes">
            <h2 id="variantes" className="text-sm font-semibold">
              Sentidos
            </h2>
            {ruta.variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">Todavía no hay trazos cargados.</p>
            ) : (
              <ul className="space-y-1.5">
                {ruta.variants.map((variante) => (
                  <li key={variante.id} className="flex items-center gap-2 text-sm">
                    <ArrowLeftRight
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">{variante.name}</span>
                    <span data-slot="distance" className="text-muted-foreground text-xs">
                      {formatDistance(variante.lengthM)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ruta.variants.length === 1 ? (
              <p className="text-muted-foreground text-xs">
                Falta el sentido de regreso. En el centro, con calles de un solo sentido, casi nunca
                es el mismo camino al revés.
              </p>
            ) : null}
          </section>

          <RouteDenominations denominaciones={ruta.denominations} />

          <RouteRatingsSummary estadisticas={ruta.ratingStats} />

          <section className="space-y-1">
            <h2 className="text-sm font-semibold">Sobre este trazo</h2>
            <p className="text-muted-foreground text-sm">
              {ruta.status === "draft"
                ? "Dibujado a mano a partir de conocimiento local. Todavía no se verifica recorriéndolo en camión, así que puede tener errores."
                : "Verificado en campo."}{" "}
              Origen del dato: {ETIQUETA_ORIGEN[ruta.dataSource]}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

const ETIQUETA_ORIGEN: Record<string, string> = {
  osm: "importado de OpenStreetMap",
  manual: "trazado a mano",
  gps: "grabado con GPS recorriendo la ruta",
  official: "fuente oficial",
};

function Dato({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Bus;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Icono className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
        <dd data-slot="distance" className="truncate text-sm font-medium">
          {valor}
        </dd>
      </div>
    </div>
  );
}
