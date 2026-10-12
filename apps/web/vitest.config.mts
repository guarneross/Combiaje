import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Pruebas de la aplicación web.
 *
 * Qué se prueba y qué no, para no acabar con mil pruebas que no dicen nada:
 *
 * - **Sí**: lo que el usuario ve en cada estado (cargando, vacío, error, con
 *   datos), y las decisiones que tomamos a propósito —el mínimo de dos letras
 *   en el buscador, no ofrecer «reintentar» cuando negó el permiso de
 *   ubicación, encontrar una ruta por su número anterior—. Son las que se
 *   romperían si alguien «simplifica» el código sin saber por qué estaba así.
 * - **No**: que React renderice, que Tailwind aplique clases, ni los detalles
 *   de maquetación. Eso lo cuida el navegador y lo vemos con los ojos.
 *
 * Las respuestas salen de los mismos handlers de MSW que usa la aplicación en
 * desarrollo. Probar contra el contrato de verdad —y no contra un `fetch`
 * falso— es lo que hace que estas pruebas sirvan de algo el día que exista el
 * backend.
 */
export default defineConfig({
  plugins: [react()],
  // Los alias `@/…` salen del tsconfig, para no mantener la misma lista dos veces.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/pruebas/configuracion.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,

    /**
     * Las mismas variables que en producción, menos los mocks: aquí MSW lo
     * arranca la configuración de pruebas, no `instrumentation`.
     *
     * `lib/env.ts` valida esto al importarse y revienta si falta, que es justo
     * lo que queremos en el servidor… pero en pruebas hay que dárselo.
     */
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_ENABLE_MOCKS: "false",
    },
  },
});
