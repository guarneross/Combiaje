import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import type { Place } from "@combiaje/shared";

import { server } from "@/mocks/server";
import { API_BASE } from "@/lib/env";
import { pagina, ruta, rutaRenumerada } from "@/pruebas/datos";
import { render, screen, waitFor } from "@/pruebas/utilidades";

import { MINIMO_BUSQUEDA, PreguntaDestino, ResultadosBusqueda } from "./busqueda-destino";

const u = (ruta: string) => `${API_BASE}${ruta}`;

const lugar = (parcial: Partial<Place> = {}): Place => ({
  id: "osm:N1",
  name: "San Ramón",
  context: "Puebla",
  lat: 19.0433,
  lng: -98.1983,
  kind: "neighborhood",
  source: "osm",
  ...parcial,
});

/**
 * Responde `/routes` y `/geocode` como lo haría el backend.
 *
 * `/geocode` se simula aquí y **no** en los handlers de desarrollo a
 * propósito: detrás hay un servicio externo, igual que las calificaciones
 * están detrás de Postgres. Una prueba que dependiera de que Photon conteste
 * no probaría nuestra pantalla.
 */
function responder({
  rutas = [ruta()],
  lugares = [lugar()],
  partial = false,
}: { rutas?: ReturnType<typeof ruta>[]; lugares?: Place[]; partial?: boolean } = {}) {
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
    http.get(u("/geocode"), () =>
      HttpResponse.json({ results: lugares, partial, attribution: "© OpenStreetMap" }),
    ),
  );
}

describe("PreguntaDestino", () => {
  it("pregunta a dónde vas: es lo primero que ve quien llega", () => {
    render(<PreguntaDestino texto="" onTexto={vi.fn()} destino={null} onQuitarDestino={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /a dónde quieres ir/i })).toBeInTheDocument();
  });

  it("avisa cada letra hacia arriba: el texto lo manda la URL, no el campo", async () => {
    const onTexto = vi.fn();
    render(<PreguntaDestino texto="" onTexto={onTexto} destino={null} onQuitarDestino={vi.fn()} />);

    await userEvent.type(screen.getByRole("searchbox"), "21");

    expect(onTexto).toHaveBeenCalledTimes(2);
    expect(onTexto).toHaveBeenLastCalledWith("1");
  });

  it("con destino elegido deja de preguntar y ofrece cambiarlo", async () => {
    const onQuitarDestino = vi.fn();
    render(
      <PreguntaDestino
        texto=""
        onTexto={vi.fn()}
        destino={{ lat: 19.0747, lng: -98.2073, nombre: "CAPU" }}
        onQuitarDestino={onQuitarDestino}
      />,
    );

    expect(screen.queryByRole("heading", { name: /a dónde quieres ir/i })).not.toBeInTheDocument();
    expect(screen.getByText("CAPU")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /cambiar de destino/i }));
    expect(onQuitarDestino).toHaveBeenCalled();
  });
});

describe("ResultadosBusqueda", () => {
  it("no busca con una sola letra: devolvería media ciudad", async () => {
    let peticiones = 0;
    server.use(
      http.get(u("/routes"), () => {
        peticiones++;
        return HttpResponse.json(pagina([ruta()]));
      }),
    );

    const { container } = render(
      <ResultadosBusqueda texto="2" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />,
    );

    expect(MINIMO_BUSQUEDA).toBe(2);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(peticiones).toBe(0));
  });

  /**
   * Las rutas se buscan con dos letras porque se buscan por número; los
   * lugares, con tres. Y detrás del geocodificador hay un servicio gratuito
   * ajeno al que no se le mandan prefijos de dos letras.
   */
  it("con dos letras busca rutas pero NO molesta al geocodificador", async () => {
    let geocodificaciones = 0;
    server.use(
      http.get(u("/routes"), () => HttpResponse.json(pagina([ruta()]))),
      http.get(u("/geocode"), () => {
        geocodificaciones++;
        return HttpResponse.json({ results: [], partial: false, attribution: "" });
      }),
    );

    render(<ResultadosBusqueda texto="72" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
    expect(geocodificaciones).toBe(0);
  });

  it("encuentra el lugar y lo devuelve con sus coordenadas, que es lo que necesita el plan", async () => {
    responder({ rutas: [] });
    const onElegirLugar = vi.fn();
    render(
      <ResultadosBusqueda texto="san ramon" onElegirLugar={onElegirLugar} onElegirRuta={vi.fn()} />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /San Ramón/i }));
    expect(onElegirLugar).toHaveBeenCalledWith({
      lat: 19.0433,
      lng: -98.1983,
      nombre: "San Ramón",
    });
  });

  it("encuentra la ruta por su número, aunque el número ya busque también lugares", async () => {
    responder({ rutas: [rutaRenumerada()], lugares: [] });
    render(<ResultadosBusqueda texto="048" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
  });

  it("encuentra por destino, no solo por número", async () => {
    responder({ lugares: [] });
    render(<ResultadosBusqueda texto="margarita" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);
    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
  });

  /**
   * Esta es la prueba que protege el *plus* del proyecto. Durante la
   * renumeración de la SMT la gente va a escribir el número viejo, porque es
   * el que se sabe. Si esto se rompe, Combiaje deja de servir justo en los dos
   * años en que más falta hace.
   */
  it("encuentra una ruta renumerada escribiendo su número ANTERIOR", async () => {
    responder({ rutas: [rutaRenumerada()], lugares: [] });
    render(<ResultadosBusqueda texto="72" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);

    expect(await screen.findByText("Centro – La Margarita")).toBeInTheDocument();
    // Y la tarjeta avisa que hoy se llama de otra forma.
    expect(screen.getByText(/antes 72/i)).toBeInTheDocument();
    expect(screen.getByText("048")).toBeInTheDocument();
  });

  it("cuando el buscador de calles no contesta, lo dice en vez de fingir que no hay nada", async () => {
    responder({
      rutas: [],
      lugares: [lugar({ id: "combiaje:1", name: "CAPU", kind: "stop", source: "combiaje" })],
      partial: true,
    });
    render(<ResultadosBusqueda texto="capu" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);

    expect(await screen.findByText("CAPU")).toBeInTheDocument();
    expect(screen.getByText(/no respondió/i)).toBeInTheDocument();
  });

  it("cuando nada coincide lo dice con el texto buscado y sugiere qué probar", async () => {
    responder({ rutas: [], lugares: [] });
    render(<ResultadosBusqueda texto="zzz" onElegirLugar={vi.fn()} onElegirRuta={vi.fn()} />);

    expect(await screen.findByText(/«zzz»/)).toBeInTheDocument();
    expect(screen.getByText(/parabrisas/i)).toBeInTheDocument();
  });

  it("al tocar una ruta avisa con el slug, que es lo que va a la URL", async () => {
    responder({ lugares: [] });
    const onElegirRuta = vi.fn();
    render(<ResultadosBusqueda texto="margarita" onElegirLugar={vi.fn()} onElegirRuta={onElegirRuta} />);

    await userEvent.click(await screen.findByRole("button", { name: /Centro – La Margarita/i }));
    expect(onElegirRuta).toHaveBeenCalledWith("ruta-72-centro-la-margarita");
  });
});
