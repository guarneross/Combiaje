import { describe, expect, it } from "vitest";

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

describe("planearViaje", () => {
  it("no propone nada cuando origen y destino están lejísimos de todo", () => {
    const plan = planearViaje({
      origin: { lat: 25.68, lng: -100.31 },
      destination: { lat: 19.43, lng: -99.13 },
    });
    expect(plan.options).toHaveLength(0);
    expect(plan.meta.maxWalkM).toBe(800);
  });
});
