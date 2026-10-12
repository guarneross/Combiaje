import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { server } from "@/mocks/server";
import { fijarEscenario } from "@/mocks/scenarios";

/**
 * Arranque común de todas las pruebas.
 *
 * MSW intercepta igual que en desarrollo, así que lo que se prueba es la
 * aplicación hablando con el contrato de API v1 de verdad, no un `fetch`
 * sustituido a mano.
 */

beforeAll(() => {
  // `error` en vez de `bypass`: si una prueba pide algo que no está en el
  // contrato, queremos que truene y nos enteremos, no que se vaya a la red.
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  fijarEscenario(null);
});

afterAll(() => {
  server.close();
});

/**
 * jsdom no implementa estas dos, y los componentes de shadcn/ui las usan.
 * Sin ellas, cualquier prueba que renderice un diálogo revienta con un error
 * que no tiene nada que ver con lo que se está probando.
 */
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
