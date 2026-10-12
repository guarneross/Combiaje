import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "@/mocks/server";
import { API_BASE } from "@/lib/env";

import { ApiError } from "./errors";
import { obtenerRuta, obtenerRutas } from "./endpoints";

/**
 * El cliente HTTP es la única puerta por la que entran datos a la aplicación,
 * y su trabajo no es traer JSON: es **no dejar pasar lo que no cumple el
 * contrato**.
 *
 * Esta prueba importa más de lo que parece hoy, con el backend simulado. El
 * día que exista la API de verdad, es la que va a avisar que el backend
 * devolvió algo distinto de lo acordado — en vez de que la pantalla se rompa
 * con un error ilegible en el celular de alguien.
 */

const u = (ruta: string) => `${API_BASE}${ruta}`;

async function capturar(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Se esperaba un ApiError y la petición salió bien.");
}

describe("cliente HTTP", () => {
  it("rechaza una respuesta que no cuadra con el esquema, aunque sea 200", async () => {
    // El backend devuelve un 200 perfectamente válido… con `fareCents` en
    // texto. Antes esto reventaba al pintar; ahora se detiene aquí.
    server.use(
      http.get(u("/routes"), () =>
        HttpResponse.json({
          items: [{ id: "no-es-uuid", slug: "ruta-1", shortName: "1", fareCents: "950" }],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        }),
      ),
    );

    const error = await capturar(obtenerRutas());
    expect(error.kind).toBe("contract");
    expect(error.esReintentable).toBe(false);
    expect(error.mensajeParaUsuario).toMatch(/no entendimos/i);
  });

  it("un 404 no se reintenta: insistir no lo convierte en 200", async () => {
    server.use(
      http.get(u("/routes/:slug"), () =>
        HttpResponse.json(
          { type: "about:blank", title: "No encontrada", status: 404 },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const error = await capturar(obtenerRuta("ruta-que-no-existe"));
    expect(error.kind).toBe("client");
    expect(error.status).toBe(404);
    expect(error.esReintentable).toBe(false);
    expect(error.mensajeParaUsuario).toBe("No encontramos lo que buscas.");
  });

  it("un 503 sí se reintenta, y el usuario no ve el número", async () => {
    server.use(
      http.get(u("/routes"), () =>
        HttpResponse.json(
          { type: "about:blank", title: "Servicio no disponible", status: 503 },
          { status: 503, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const error = await capturar(obtenerRutas());
    expect(error.kind).toBe("server");
    expect(error.esReintentable).toBe(true);
    expect(error.mensajeParaUsuario).not.toMatch(/503/);
  });

  it("sin red, el mensaje habla de datos y WiFi, no de DNS", async () => {
    server.use(http.get(u("/routes"), () => HttpResponse.error()));

    const error = await capturar(obtenerRutas());
    expect(error.kind).toBe("network");
    expect(error.esReintentable).toBe(true);
    expect(error.mensajeParaUsuario).toMatch(/conexión/i);
  });

  it("un 429 se reintenta aunque sea 4xx, y lo dice en cristiano", async () => {
    server.use(
      http.get(u("/routes"), () =>
        HttpResponse.json(
          { type: "about:blank", title: "Demasiadas peticiones", status: 429 },
          { status: 429, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const error = await capturar(obtenerRutas());
    expect(error.esReintentable).toBe(true);
    expect(error.mensajeParaUsuario).toMatch(/espera un momento/i);
  });
});
