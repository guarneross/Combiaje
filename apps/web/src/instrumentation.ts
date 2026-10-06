/**
 * Arranque de MSW **del lado del servidor**.
 *
 * La ficha de ruta se renderiza en servidor para que sea indexable, así que el
 * servidor también necesita poder consultar la API. Como todavía no existe,
 * aquí se levanta el mismo juego de handlers que usa el navegador: el servidor
 * pide `/api/v1/routes/:slug` y MSW responde, sin que nada en el código sepa
 * que no hay backend.
 *
 * `instrumentation.ts` corre una sola vez al arrancar el servidor, antes de
 * atender la primera petición. Es el gemelo de `instrumentation-client.ts`.
 */
export async function register() {
  if (process.env["NEXT_PUBLIC_ENABLE_MOCKS"] !== "true") return;
  // Solo en el entorno de Node. En el Edge Runtime no hay `msw/node`.
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  const { server } = await import("./mocks/server");
  server.listen({ onUnhandledFrame: "bypass" });
  console.warn("[combiaje] MSW activo en el servidor: los datos son simulados.");
}
