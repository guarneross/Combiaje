import { env } from "@/lib/env";

/**
 * Arranque de Mock Service Worker.
 *
 * Por qué aquí y no dentro de un componente: el paquete `msw` publica
 * `msw/browser` con la condición `"node": null`, o sea que resolverlo en un
 * entorno de servidor es un error a propósito. Next compila cada componente
 * de cliente dos veces —para el navegador y para el renderizado en servidor—
 * así que importar `msw/browser` desde un componente rompe el build con
 * «Module not found: Can't resolve 'msw/browser'».
 *
 * `instrumentation-client.ts` solo se empaqueta para el navegador y corre
 * antes de que hidrate la aplicación: es justo el lugar para esto.
 *
 * Deja la promesa en `window` para que <MswProvider> espere a que el worker
 * esté listo antes de pintar. Si una consulta sale antes de tiempo, se va a la
 * red de verdad y el usuario ve un error que no existe.
 */

if (env.NEXT_PUBLIC_ENABLE_MOCKS) {
  window.__combiajeMocksListos = (async () => {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      // Todo lo que no sea del contrato (teselas, estilos del mapa, fuentes)
      // pasa directo a la red.
      // Ojo: en MSW 3 la opción se llama `onUnhandledFrame`; en MSW 2 era
      // `onUnhandledRequest`, que es como sigue apareciendo en casi toda la
      // documentación que anda por ahí.
      onUnhandledFrame: "bypass",
      quiet: true,
      serviceWorker: { url: "/mockServiceWorker.js" },
    });
    console.warn(
      "[combiaje] MSW activo: los datos son simulados, no el dataset real.",
    );
  })();
}

export {};
