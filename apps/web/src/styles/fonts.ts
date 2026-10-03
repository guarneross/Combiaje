import localFont from "next/font/local";

/**
 * Inter variable, subconjunto latino, auto-hospedada: 48 KB.
 *
 * Por qué local y no next/font/google: la fuente se sirve desde el mismo
 * dominio, sin una petición extra a fonts.gstatic.com y sin resolución DNS
 * adicional. En 4G con sol en la pantalla, eso son cientos de milisegundos
 * menos antes del primer texto legible.
 *
 * `display: "swap"` a propósito: preferimos texto feo inmediato a texto
 * invisible. El usuario está parado en la calle.
 */
export const inter = localFont({
  src: [
    {
      path: "./fonts/InterVariable-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: "Arial",
});
