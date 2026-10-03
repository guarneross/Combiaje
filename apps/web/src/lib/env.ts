import { z } from "zod";

/**
 * Variables de entorno públicas, validadas al arrancar.
 *
 * Next sustituye `process.env.NEXT_PUBLIC_*` en tiempo de compilación solo si
 * se escribe el nombre completo y literal. Por eso el objeto se arma a mano y
 * no con un bucle sobre process.env.
 *
 * Si falta algo, queremos enterarnos en el build, no en el celular de alguien
 * parado en una esquina.
 */

const booleanish = z
  .enum(["true", "false", "1", "0", ""])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url({ message: "NEXT_PUBLIC_API_URL debe ser una URL válida" }),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_MOCKS: booleanish.default(false),
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .string()
    .min(1)
    .default("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"),
  NEXT_PUBLIC_MAP_STYLE_URL_DARK: z
    .string()
    .min(1)
    .default("https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_MAP_STYLE_URL_DARK: process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK,
});

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  · ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(
    `Faltan o están mal las variables de entorno de apps/web:\n${detalle}\n\n` +
      `Copia apps/web/.env.example a apps/web/.env.local y vuelve a intentar.`,
  );
}

export const env = parsed.data;

/** Base completa del contrato de API v1. */
export const API_BASE = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api/v1`;
