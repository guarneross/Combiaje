import { describe, expect, it } from "vitest";
import type { BusLeg, TripOption } from "@combiaje/shared";

import type { RutaSimulada } from "./dataset";
import {
  buscarRutas,
  existeRuta,
  geojsonDeRuta,
  planearViaje,
  rutaPorSlug,
  rutasCercanas,
} from "./consultas";

/**
 * Pruebas de las consultas sobre el dataset.
 *
 * Estas sí corren contra el dataset de verdad —no contra datos inventados—
 * porque lo que comprueban son **invariantes**, no contenidos: nada aquí
 * afirma «hay tres rutas» ni «existe la 21». Esa disciplina es lo que permite
 * que sigan pasando el día que el dataset tenga veinticinco rutas.
 */

const TODAS = buscarRutas({ limit: 100 }).items;

describe("buscarRutas", () => {
  it("encuentra cada ruta del dataset por su propio número", () => {
    for (const ruta of TODAS) {
      const encontradas = buscarRutas({ q: ruta.shortName, limit: 100 }).items;
      expect(
        encontradas.some((r) => r.slug === ruta.slug),
        `buscar «${ruta.shortName}» no encontró ${ruta.slug}`,
      ).toBe(true);
    }
  });

  it("encuentra cada ruta por cualquiera de sus números anteriores", () => {
    for (const ruta of TODAS) {
      for (const d of ruta.denominations) {
        const encontradas = buscarRutas({ q: d.shortName, limit: 100 }).items;
        expect(
          encontradas.some((r) => r.slug === ruta.slug),
          `buscar «${d.shortName}» no encontró ${ruta.slug}`,
        ).toBe(true);
      }
    }
  });

  it("no inventa resultados con un texto que no existe", () => {
    const resultado = buscarRutas({ q: "zzzzqqq-no-existe" });
    expect(resultado.items).toHaveLength(0);
    expect(resultado.total).toBe(0);
    expect(resultado.totalPages).toBe(1);
  });

  it("ignora acentos y mayúsculas, que es como la gente escribe de prisa", () => {
    for (const ruta of TODAS.filter((r) => /[áéíóú]/i.test(r.longName))) {
      const sinAcentos = ruta.longName.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const encontradas = buscarRutas({ q: sinAcentos.toUpperCase(), limit: 100 }).items;
      expect(encontradas.some((r) => r.slug === ruta.slug)).toBe(true);
    }
  });

  it("pagina sin perder ni repetir elementos", () => {
    const porPagina = buscarRutas({ limit: 1, page: 1 });
    expect(porPagina.items.length).toBeLessThanOrEqual(1);
    expect(porPagina.totalPages).toBe(porPagina.total);

    const vistos = new Set<string>();
    for (let p = 1; p <= porPagina.totalPages; p++) {
      for (const r of buscarRutas({ limit: 1, page: p }).items) vistos.add(r.slug);
    }
    expect(vistos.size).toBe(porPagina.total);
  });
});

describe("rutaPorSlug y existeRuta", () => {
  it("devuelven null y false para algo que no existe", () => {
    expect(rutaPorSlug("ruta-que-no-existe")).toBeNull();
    expect(existeRuta("ruta-que-no-existe")).toBe(false);
    expect(geojsonDeRuta("ruta-que-no-existe")).toBeNull();
  });

  it("concuerdan entre sí para todo el dataset", () => {
    for (const ruta of TODAS) {
      expect(existeRuta(ruta.slug)).toBe(true);
      expect(rutaPorSlug(ruta.slug)?.slug).toBe(ruta.slug);
    }
  });

  it("la ficha no arrastra la geometría: eso se pide aparte", () => {
    for (const ruta of TODAS) {
      expect(rutaPorSlug(ruta.slug)).not.toHaveProperty("geometrias");
    }
  });

  it("el geojson trae una línea por sentido, con su recuadro", () => {
    for (const ruta of TODAS) {
      const geo = geojsonDeRuta(ruta.slug)!;
      const detalle = rutaPorSlug(ruta.slug)!;
      expect(geo.features).toHaveLength(detalle.variants.length);
      expect(geo.bbox).toHaveLength(4);
      for (const f of geo.features) {
        expect(f.geometry.type).toBe("LineString");
        expect(f.geometry.coordinates.length).toBeGreaterThan(1);
      }
    }
  });
});

describe("rutasCercanas", () => {
  it("no devuelve nada desde el otro lado del país", () => {
    // Monterrey. Si algo sale aquí, la distancia está mal calculada.
    expect(rutasCercanas({ lat: 25.68, lng: -100.31, radius: 2000 }).routes).toHaveLength(0);
  });

  it("devuelve las rutas ordenadas por cercanía y dentro del radio pedido", () => {
    const radio = 5000;
    const { routes, radiusM } = rutasCercanas({ lat: 19.0433, lng: -98.1983, radius: radio });

    expect(radiusM).toBe(radio);
    for (const r of routes) expect(r.distanceM).toBeLessThanOrEqual(radio);
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i]!.distanceM).toBeGreaterThanOrEqual(routes[i - 1]!.distanceM);
    }
  });

  it("respeta el límite", () => {
    expect(rutasCercanas({ lat: 19.0433, lng: -98.1983, radius: 50_000, limit: 1 }).routes.length)
      .toBeLessThanOrEqual(1);
  });
});

/**
 * El planificador se prueba sobre una avenida inventada, no sobre el dataset.
 *
 * Es la excepción a la regla de arriba, y a propósito: lo que hay que
 * comprobar es **la regla del orden** —que una ruta solo sirve si pasa por el
 * origen antes que por el destino—, y para eso hace falta saber de antemano
 * hacia dónde va el trazo. Con el dataset real no se puede afirmar nada así
 * sin que la prueba se rompa en cuanto alguien suba una ruta nueva.
 *
 * Sin esta regla, toda ruta que tocara los dos puntos aparecía dos veces, ida
 * y vuelta, y una de las dos llevaba al lado opuesto de la ciudad.
 */

const LAT = 19.04;

/** Un punto a `metros` al oriente del arranque de la avenida de prueba. */
function alOriente(metros: number): [number, number] {
  const gradosPorMetro = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
  return [-98.25 + metros * gradosPorMetro, LAT];
}

/** El mismo punto, pero a `metros` al norte: la caminata hasta la avenida. */
function alNorte(punto: [number, number], metros: number): [number, number] {
  return [punto[0], punto[1] + metros / 110_540];
}

/** Una avenida recta de 6 km de poniente a oriente, con sus dos sentidos. */
function avenida(parcial: Partial<RutaSimulada> = {}): RutaSimulada {
  const ida: [number, number][] = [0, 1500, 3000, 4500, 6000].map(alOriente);
  const vuelta = [...ida].reverse();
  const id = "22222222-2222-4222-8222-000000000001";

  return {
    id,
    slug: "ruta-99-poniente-oriente",
    shortName: "99",
    longName: "Poniente – Oriente",
    color: "#059669",
    textColor: "#FFFFFF",
    colorSecondary: null,
    basin: null,
    denominations: [],
    fareCents: 950,
    status: "published",
    agency: null,
    dataSource: "manual",
    updatedAt: "2026-10-15T00:00:00.000Z",
    ratingStats: null,
    variants: [
      {
        id: "44444444-4444-4444-8444-000000000001",
        routeId: id,
        name: "Ida",
        direction: 0,
        lengthM: 6000,
        isPrimary: true,
      },
      {
        id: "44444444-4444-4444-8444-000000000002",
        routeId: id,
        name: "Vuelta",
        direction: 1,
        lengthM: 6000,
        isPrimary: false,
      },
    ],
    geometrias: [ida, vuelta],
    ...parcial,
  } as RutaSimulada;
}

const camionDe = (opcion: TripOption) =>
  opcion.legs.find((tramo) => tramo.mode === "bus") as BusLeg;

/** Al poniente de la avenida, 150 m al norte de ella. */
const puntoA = alNorte(alOriente(500), 150);
/** Al oriente, 200 m al norte. */
const puntoB = alNorte(alOriente(5000), 200);

const planEntre = (
  desde: [number, number],
  hasta: [number, number],
  opciones: { maxWalkM?: number; rutas?: RutaSimulada[] } = {},
) =>
  planearViaje(
    {
      origin: { lat: desde[1], lng: desde[0] },
      destination: { lat: hasta[1], lng: hasta[0] },
      ...(opciones.maxWalkM ? { maxWalkM: opciones.maxWalkM } : {}),
    },
    opciones.rutas ?? [avenida()],
  );

describe("planearViaje", () => {
  it("no propone nada cuando origen y destino están lejísimos de todo", () => {
    const plan = planearViaje({
      origin: { lat: 25.68, lng: -100.31 },
      destination: { lat: 19.43, lng: -99.13 },
    });
    expect(plan.options).toHaveLength(0);
    expect(plan.meta.maxWalkM).toBe(800);
  });

  it("de poniente a oriente propone la ida, y SOLO la ida", () => {
    const plan = planEntre(puntoA, puntoB);
    expect(plan.options).toHaveLength(1);
    expect(camionDe(plan.options[0]!).variantName).toBe("Ida");
  });

  it("de oriente a poniente propone la vuelta: misma calle, otro sentido", () => {
    const plan = planEntre(puntoB, puntoA);
    expect(plan.options).toHaveLength(1);
    expect(camionDe(plan.options[0]!).variantName).toBe("Vuelta");
  });

  it("la distancia a bordo son los metros entre donde subes y donde bajas", () => {
    const camion = camionDe(planEntre(puntoA, puntoB).options[0]!);
    // 500 m → 5000 m sobre la avenida, con holgura por la aproximación
    // equirrectangular.
    expect(camion.onboardDistanceM).toBeGreaterThan(4300);
    expect(camion.onboardDistanceM).toBeLessThan(4700);
  });

  it("sube y baja SOBRE el trazo, no en las coordenadas de quien pregunta", () => {
    const camion = camionDe(planEntre(puntoA, puntoB).options[0]!);
    expect(camion.boardAt.lat).toBeCloseTo(LAT, 4);
    expect(camion.alightAt.lat).toBeCloseTo(LAT, 4);
    expect(camion.boardAt.lat).not.toBeCloseTo(puntoA[1], 4);
  });

  it("descarta la ruta que pasa lejos del destino aunque pase por tu puerta", () => {
    expect(planEntre(puntoA, alNorte(alOriente(5000), 3000)).options).toEqual([]);
  });

  it("no propone camión para tres cuadras: la respuesta honesta es caminar", () => {
    expect(planEntre(puntoA, alNorte(alOriente(600), 100)).options).toEqual([]);
  });

  it("devuelve el slug de la ruta: sin él el mapa no puede dibujar nada", () => {
    expect(camionDe(planEntre(puntoA, puntoB).options[0]!).routeSlug).toBe(
      "ruta-99-poniente-oriente",
    );
  });

  it("cada ruta aporta una sola opción, no una por sentido", () => {
    const plan = planEntre(puntoA, puntoB, {
      rutas: [avenida(), avenida({ slug: "ruta-98-paralela", shortName: "98" })],
    });
    expect(plan.options.map((o) => camionDe(o).routeSlug)).toEqual([
      "ruta-99-poniente-oriente",
      "ruta-98-paralela",
    ]);
  });

  it("respeta cuánto está dispuesto a caminar quien pregunta", () => {
    const lejosDeLaAvenida = alNorte(alOriente(3000), 700);
    expect(planEntre(lejosDeLaAvenida, puntoB, { maxWalkM: 800 }).options).toHaveLength(1);
    expect(planEntre(lejosDeLaAvenida, puntoB, { maxWalkM: 300 }).options).toEqual([]);
  });
});
