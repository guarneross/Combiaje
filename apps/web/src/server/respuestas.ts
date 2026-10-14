import { NextResponse } from "next/server";

/**
 * Las respuestas de la API, en un solo lugar.
 *
 * Todo error sale en formato RFC 7807 (`application/problem+json`), como manda
 * el contrato. El cliente HTTP del navegador ya sabe leerlo: convierte el
 * `title` en el mensaje que ve el usuario cuando no tiene uno mejor.
 */

export function ok<T>(datos: T, segundosDeCache = 0) {
  return NextResponse.json(datos, {
    headers: segundosDeCache
      ? {
          // `stale-while-revalidate`: el intermediario puede servir lo viejo
          // mientras pide lo nuevo. Para un catálogo de rutas que cambia cada
          // varias semanas, es la diferencia entre una API y un archivo.
          "Cache-Control": `public, max-age=0, s-maxage=${segundosDeCache}, stale-while-revalidate=${segundosDeCache * 4}`,
        }
      : undefined,
  });
}

export function problema(status: number, title: string, detail?: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, ...(detail ? { detail } : {}) },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

export const noEncontrada = (slug: string) =>
  problema(404, "Esa ruta no existe", `No hay ninguna ruta con el identificador ${slug}.`);

export const sinSesion = () =>
  problema(401, "Necesitas una sesión para calificar", "Falta la cabecera Authorization.");

export const sinBase = () =>
  problema(
    503,
    "Las calificaciones no están disponibles",
    "Esta instalación todavía no tiene base de datos configurada.",
  );
