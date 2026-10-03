import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { env } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import { AppProviders } from "@/providers/app-providers";
import { inter } from "@/styles/fonts";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${SITE_NAME} · Transporte público de Puebla`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Puebla", "transporte público", "camiones", "combis", "rutas", "RUTA", "mapa"],
  authors: [{ name: "Combiaje" }],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Transporte público de Puebla`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // Proyecto ciudadano independiente: no insinuamos vínculo oficial.
  other: { "x-combiaje-proyecto": "ciudadano-independiente" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // El mapa va a pantalla completa: necesitamos el área del notch.
  viewportFit: "cover",
  // No bloqueamos el zoom del usuario: accesibilidad antes que estética.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#13161f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" suppressHydrationWarning className={inter.variable}>
      <body>
        <a
          href="#contenido"
          className="bg-background focus:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2"
        >
          Saltar al contenido
        </a>

        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
