import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "@/mocks/server";
import { API_BASE } from "@/lib/env";
import { cercana } from "@/pruebas/datos";
import { render, screen, waitFor } from "@/pruebas/utilidades";

import { NearbyButton, NearbyResults } from "./nearby-list";

/**
 * «Rutas cerca de mí» es la razón de existir de la pantalla principal, y la
 * única parte de la aplicación que depende de un permiso que el usuario puede
 * negar. Por eso se prueban los cuatro desenlaces: lo encontró, no encontró
 * nada, falló la API, y falló la ubicación.
 */

const u = (ruta: string) => `${API_BASE}${ruta}`;

const UBICADO = { estado: "lista", lat: 19.0433, lng: -98.1983, precisionM: 18 } as const;

function responderCercanas(rutas: ReturnType<typeof cercana>[], radiusM = 500) {
  server.use(http.get(u("/nearby"), () => HttpResponse.json({ routes: rutas, radiusM })));
}

function propsResultados(extra: Partial<Parameters<typeof NearbyResults>[0]> = {}) {
  return {
    ubicacion: UBICADO,
    radio: 500,
    onRadio: vi.fn(),
    onPedir: vi.fn(),
    onSeleccionar: vi.fn(),
    ...extra,
  } as Parameters<typeof NearbyResults>[0];
}

describe("NearbyButton", () => {
  it("invita a ubicarse cuando todavía no sabemos dónde está", () => {
    render(<NearbyButton ubicacion={{ estado: "inactiva" }} onPedir={vi.fn()} />);
    expect(screen.getByRole("button", { name: /rutas cerca de mí/i })).toBeEnabled();
  });

  it("se bloquea mientras el GPS responde, para no pedir dos veces", () => {
    render(<NearbyButton ubicacion={{ estado: "pidiendo" }} onPedir={vi.fn()} />);
    expect(screen.getByRole("button", { name: /buscando dónde estás/i })).toBeDisabled();
  });

  it("desaparece una vez que ya nos ubicó: su trabajo terminó", () => {
    const { container } = render(<NearbyButton ubicacion={UBICADO} onPedir={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("NearbyResults", () => {
  it("lista las rutas con su distancia al trazo", async () => {
    responderCercanas([
      cercana({ shortName: "21", longName: "Canal – Rincón", distanceM: 120 }),
      cercana({
        id: "44444444-4444-4444-8444-444444444444",
        slug: "ruta-72-centro-la-margarita",
        shortName: "72",
        longName: "Centro – La Margarita",
        distanceM: 340,
      }),
    ]);

    render(<NearbyResults {...propsResultados()} />);

    expect(await screen.findByText("Canal – Rincón")).toBeInTheDocument();
    expect(screen.getByText("Centro – La Margarita")).toBeInTheDocument();
    // El resumen dice cuántas son y con qué precisión, porque un «±18 m» es la
    // diferencia entre confiar en la lista y no entenderla.
    expect(screen.getByRole("status")).toHaveTextContent(/2 rutas pasan a menos de 500 m/i);
    expect(screen.getByRole("status")).toHaveTextContent(/±18 m/);
  });

  it("concuerda el singular cuando solo pasa una ruta", async () => {
    responderCercanas([cercana()]);
    render(<NearbyResults {...propsResultados()} />);

    // Primero esperar al dato: el esqueleto de carga también es un `status`
    // (dice «Cargando rutas…» para los lectores de pantalla) y lo tomaría.
    await screen.findByText("Canal – Rincón");
    expect(screen.getByRole("status")).toHaveTextContent(/1 ruta pasa a menos de/i);
  });

  it("al no haber nada cerca, ofrece ampliar el radio en vez de dejarte seco", async () => {
    responderCercanas([]);
    const onRadio = vi.fn();
    render(<NearbyResults {...propsResultados({ onRadio })} />);

    expect(await screen.findByText(/no hay rutas a menos de 500 m/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /buscar a 1 km/i }).click();
    expect(onRadio).toHaveBeenCalledWith(1000);
  });

  it("deja de ofrecer más radio cuando ya se buscó a 2 km", async () => {
    responderCercanas([], 2000);
    render(<NearbyResults {...propsResultados({ radio: 2000 })} />);

    expect(await screen.findByText(/no hay rutas a menos de 2000 m/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /buscar a/i })).not.toBeInTheDocument();
  });

  it("ante un fallo de la API muestra el mensaje para humanos y un reintento", async () => {
    server.use(
      http.get(u("/nearby"), () =>
        HttpResponse.json(
          { type: "about:blank", title: "Servicio no disponible", status: 503 },
          { status: 503, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    render(<NearbyResults {...propsResultados()} />);

    const reintentar = await screen.findByRole("button", { name: /reintentar/i });
    expect(reintentar).toBeInTheDocument();
    // Nada de «Error 503» en la cara del usuario.
    expect(screen.queryByText(/503/)).not.toBeInTheDocument();
  });

  it("si negaron el permiso, NO ofrece reintentar: hay que cambiarlo en el navegador", async () => {
    render(
      <NearbyResults
        {...propsResultados({
          ubicacion: {
            estado: "error",
            motivo: "denegado",
            mensaje: "No nos diste permiso de ubicación.",
          },
        })}
      />,
    );

    expect(await screen.findByText(/no pudimos ubicarte/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it("si el GPS falló por otra razón, sí ofrece reintentar", async () => {
    const onPedir = vi.fn();
    render(
      <NearbyResults
        {...propsResultados({
          onPedir,
          ubicacion: {
            estado: "error",
            motivo: "tiempo-agotado",
            mensaje: "Tardó demasiado en ubicarte.",
          },
        })}
      />,
    );

    const reintentar = await screen.findByRole("button", { name: /reintentar/i });
    reintentar.click();
    expect(onPedir).toHaveBeenCalled();
  });

  it("no pide nada a la API mientras no haya ubicación", async () => {
    let peticiones = 0;
    server.use(
      http.get(u("/nearby"), () => {
        peticiones++;
        return HttpResponse.json({ routes: [], radiusM: 500 });
      }),
    );

    const { container } = render(
      <NearbyResults {...propsResultados({ ubicacion: { estado: "inactiva" } })} />,
    );

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(peticiones).toBe(0));
  });
});
