import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";

/**
 * Manifest de la PWA. Serwist (el service worker) entra después del bloque 5:
 * un service worker cacheando un andamiaje que cambia todos los días solo
 * sirve versiones viejas y hace perder horas de depuración.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Transporte público de Puebla`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "es-MX",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2b43c0",
    categories: ["navigation", "travel", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
