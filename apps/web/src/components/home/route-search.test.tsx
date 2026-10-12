import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";

import { server } from "@/mocks/server";
import { API_BASE } from "@/lib/env";
import { pagina, ruta, rutaRenumerada } from "@/pruebas/datos";
import { render, screen, waitFor } from "@/pruebas/utilidades";

import { MINIMO_BUSQUEDA, SearchInput, SearchResults } from "./route-search";

const u = (ruta: string) => `${API_BASE}${ruta}`;

/** Responde `GET /routes` filtrando por `q` igual que lo haría el backend. */
function responderBusqueda(rutas = [ruta()]) {
  server.use(
    http.get(u("/routes"), ({ request }) => {
      const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
      const encontradas = rutas.filter(
        (r) =>
          r.shortName.toLowerCase().includes(q) ||
          r.longName.toLowerCase().includes(q) ||
          r.denominations.some((d) => d.shortName.toLowerCase().includes(q)),
      );
      return HttpResponse.json(pagina(encontradas));
    }),
  );
}

describe("SearchInput", () => {
  it("avisa cada letra hacia arriba: el texto lo manda la URL, no el campo", async () => {
    const onTexto = vi.fn();
    render(<SearchInput texto="" onTexto={onTexto} />);

    await userEvent.type(screen.getByRole("searchbox"), "21");

    expect(onTexto).toHaveBeenCalledTimes(2);
    expect(onTexto).toHaveBeenLastCalledWith("1");
  });
});

describe("SearchResults", () => {
  it("no busca con una sola letra: devolvería media ciudad", async () => {
    let peticiones = 0;
    server.use(
      http.get(u("/routes"), () => {
        peticiones++;
        return HttpResponse.json(pagina([ruta()]));
      }),
    );

    const { container } = render(<SearchResults texto="2" onSeleccionar={vi.fn()} />);

    expect(MINIMO_BUSQUEDA).toBe(2);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(peticiones).toBe(0));
  });

  it("encuentra por número y enseña cuántos resultados hay", async () => {
    responderBusqueda();
    render(<SearchResults texto="72" onSeleccionar={vi.fn()} />);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/1 resultado/);
  });

  it("encuentra por destino, no solo por número", async () => {
    responderBusqueda();
    render(<SearchResults texto="margarita" onSeleccionar={vi.fn()} />);
    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
  });

  /**
   * Esta es la prueba que protege el *plus* del proyecto. Durante la
   * renumeración de la SMT la gente va a escribir el número viejo, porque es
   * el que se sabe. Si esto se rompe, Combiaje deja de servir justo en los dos
   * años en que más falta hace.
   */
  it("encuentra una ruta renumerada escribiendo su número ANTERIOR", async () => {
    responderBusqueda([rutaRenumerada()]);
    render(<SearchResults texto="72" onSeleccionar={vi.fn()} />);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
    // Y la tarjeta avisa que hoy se llama de otra forma.
    expect(screen.getByText(/antes 72/i)).toBeInTheDocument();
    expect(screen.getByText("048")).toBeInTheDocument();
  });

  it("cuando nada coincide, lo dice con el texto buscado y sugiere qué probar", async () => {
    responderBusqueda();
    render(<SearchResults texto="zzz" onSeleccionar={vi.fn()} />);

    expect(await screen.findByText(/ninguna ruta coincide/i)).toBeInTheDocument();
    expect(screen.getByText(/«zzz»/)).toBeInTheDocument();
    expect(screen.getByText(/parabrisas/i)).toBeInTheDocument();
  });

  it("ante un fallo de la API ofrece reintentar, y al segundo intento ya hay datos", async () => {
    let intentos = 0;
    server.use(
      http.get(u("/routes"), () => {
        intentos++;
        if (intentos === 1) {
          return HttpResponse.json(
            { type: "about:blank", title: "Servicio no disponible", status: 503 },
            { status: 503, headers: { "Content-Type": "application/problem+json" } },
          );
        }
        return HttpResponse.json(pagina([ruta()]));
      }),
    );

    render(<SearchResults texto="72" onSeleccionar={vi.fn()} />);

    const reintentar = await screen.findByRole("button", { name: /reintentar/i });
    await userEvent.click(reintentar);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
  });

  it("al tocar un resultado avisa con el slug, que es lo que va a la URL", async () => {
    responderBusqueda();
    const onSeleccionar = vi.fn();
    render(<SearchResults texto="72" onSeleccionar={onSeleccionar} />);

    await userEvent.click(await screen.findByRole("button", { name: /Centro – La Margarita/i }));
    expect(onSeleccionar).toHaveBeenCalledWith("ruta-72-centro-la-margarita");
  });
});
