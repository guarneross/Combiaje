import type { NearbyRoute, RouteSummary } from "@combiaje/shared";

/**
 * Datos de prueba, con la forma exacta del contrato de API v1.
 *
 * Deliberadamente **no** se usan las rutas de `mocks/data/puebla.ts`: ese
 * archivo cambia cada vez que se traza una ruta real, y una prueba que afirme
 * «hay tres resultados» empezaría a fallar el día que alguien suba la cuarta
 * ruta de Puebla. Las pruebas traen sus propios datos y sobrescriben los
 * handlers; lo que se prueba es la pantalla, no el dataset.
 */

export const CONCESIONARIA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autotransportes Unidos de Puebla",
  shortName: "AUP",
  type: "urbano" as const,
};

export function ruta(parcial: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "ruta-72-centro-la-margarita",
    shortName: "72",
    longName: "Centro – La Margarita",
    color: "#059669",
    textColor: "#FFFFFF",
    fareCents: 950,
    status: "draft",
    agency: CONCESIONARIA,
    colorSecondary: null,
    basin: null,
    denominations: [],
    ...parcial,
  };
}

/** La misma ruta, pero renumerada por la SMT: antes 72, hoy 048. */
export function rutaRenumerada(): RouteSummary {
  return ruta({
    shortName: "048",
    color: "#7C3AED",
    colorSecondary: "#D97706",
    basin: "Cuenca Oriente",
    denominations: [
      {
        shortName: "72",
        longName: "Centro – La Margarita",
        colors: ["#059669"],
        basin: null,
        from: null,
        until: "2026-10-15",
        current: false,
        source: "nomenclatura anterior",
      },
      {
        shortName: "048",
        longName: "Centro – La Margarita",
        colors: ["#7C3AED", "#D97706"],
        basin: "Cuenca Oriente",
        from: "2026-10-15",
        until: null,
        current: true,
        source: "smt",
      },
    ],
  });
}

export function cercana(parcial: Partial<NearbyRoute> = {}): NearbyRoute {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "ruta-21-canal-rincon",
    shortName: "21",
    longName: "Canal – Rincón",
    color: "#E11D48",
    distanceM: 120,
    ...parcial,
  };
}

/** La envoltura que devuelve `GET /routes`. */
export function pagina(items: RouteSummary[]) {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1 };
}
