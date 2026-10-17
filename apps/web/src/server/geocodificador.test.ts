import { describe, expect, it } from "vitest";

import { interpretarPhoton } from "./geocodificador";

/**
 * Lo que se prueba aquí es **traducir la respuesta de Photon**, sin red.
 *
 * Es donde está todo lo que puede salir mal —un rasgo sin nombre, una
 * coordenada en otro estado, el mismo lugar cartografiado dos veces— y nada
 * de eso debería necesitar internet para comprobarse. Lo que no se prueba es
 * que Photon conteste: eso no depende de nosotros, y por eso el
 * geocodificador está escrito para seguir funcionando cuando no conteste.
 */

/** Un rasgo de Photon, con lo mínimo y lo que se le quiera agregar. */
function rasgo(props: Record<string, unknown>, lng = -98.1983, lat = 19.0433) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { osm_id: 1, osm_type: "N", ...props },
  };
}

const coleccion = (features: unknown[]) => ({ type: "FeatureCollection", features });

describe("interpretarPhoton", () => {
  it("traduce un lugar con su contexto", () => {
    const [lugar] = interpretarPhoton(
      coleccion([
        rasgo({
          name: "San Ramón",
          osm_key: "place",
          osm_value: "neighbourhood",
          district: "San Ramón",
          city: "Puebla",
          state: "Puebla",
        }),
      ]),
    );

    expect(lugar).toMatchObject({
      name: "San Ramón",
      kind: "neighborhood",
      source: "osm",
      lat: 19.0433,
      lng: -98.1983,
    });
    // Sin repetir: en la capital, el nombre de la ciudad y el del estado son
    // la misma palabra, y el del barrio ya está en el título.
    expect(lugar!.context).toBe("Puebla");
  });

  it("tira lo que cae fuera del área metropolitana", () => {
    const lugares = interpretarPhoton(
      coleccion([
        rasgo({ name: "Centro", osm_key: "place" }),
        // Centro histórico de Veracruz.
        rasgo({ name: "Centro", osm_key: "place" }, -96.13, 19.19),
      ]),
    );

    expect(lugares).toHaveLength(1);
  });

  it("arma el nombre de una calle con número cuando no viene `name`", () => {
    const [lugar] = interpretarPhoton(
      coleccion([rasgo({ street: "25 Poniente", housenumber: "308", osm_key: "highway" })]),
    );

    expect(lugar?.name).toBe("25 Poniente 308");
    expect(lugar?.kind).toBe("street");
  });

  it("descarta lo que no tiene manera de nombrarse", () => {
    expect(interpretarPhoton(coleccion([rasgo({ osm_key: "amenity" })]))).toEqual([]);
  });

  it("no repite el lugar que está cartografiado como punto y como polígono", () => {
    const lugares = interpretarPhoton(
      coleccion([
        rasgo({ name: "Mercado Zapata", osm_key: "amenity", osm_value: "marketplace" }),
        {
          ...rasgo({ name: "Mercado Zapata", osm_key: "amenity", osm_value: "marketplace" }),
          properties: { osm_id: 2, osm_type: "W", name: "Mercado Zapata", osm_key: "amenity" },
        },
      ]),
    );

    expect(lugares).toHaveLength(1);
  });

  it("pone primero lo que de verdad sirve de destino", () => {
    const lugares = interpretarPhoton(
      coleccion([
        rasgo({ name: "Cajero Angelópolis", osm_key: "amenity", osm_value: "atm" }),
        rasgo({ name: "Angelópolis", osm_key: "place", osm_value: "suburb" }),
      ]),
    );

    expect(lugares.map((l) => l.kind)).toEqual(["neighborhood", "poi"]);
  });

  it("aguanta una respuesta rota sin tirar la petición", () => {
    expect(interpretarPhoton(null)).toEqual([]);
    expect(interpretarPhoton({})).toEqual([]);
    expect(interpretarPhoton({ features: "no soy un arreglo" })).toEqual([]);
    expect(interpretarPhoton(coleccion([{ type: "Feature" }]))).toEqual([]);
  });
});
