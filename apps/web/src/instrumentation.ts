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

  // Si esto falla, Next no arranca el servidor y **todo el sitio responde 500**.
  // Pasó en el primer despliegue: `@mswjs/interceptors` lee un `.wasm` que el
  // empaquetado dejó apuntando a la carpeta de compilación, que en Hostinger
  // desaparece al publicar. Se arregló marcando msw como paquete externo (ver
  // `next.config.ts`), pero la capa de datos simulados no merece poder tirar el
  // sitio: si vuelve a fallar, que se caigan los datos, no el servidor.
  try {
    const { server } = await import("./mocks/server");
    server.listen({ onUnhandledFrame: "bypass" });
    console.warn("[combiaje] MSW activo en el servidor: los datos son simulados.");
  } catch (error) {
    console.error(
      "[combiaje] No se pudo arrancar MSW en el servidor. El sitio sigue en pie, " +
        "pero las páginas renderizadas en servidor van a mostrar su estado de error.",
      error,
    );
  }
}
