import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Despliegue en Hostinger (Node 24, hosting administrado), no en Vercel.
  // `standalone` produce un servidor autocontenido en .next/standalone con
  // solo las dependencias que de verdad se usan: se sube y se corre con
  // `node server.js`, sin `pnpm install` en el servidor.
  output: "standalone",

  // En un monorepo, el rastreo de archivos del build arranca en apps/web y se
  // deja fuera packages/shared. Esto le dice dónde está la raíz de verdad.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),

  // packages/shared se publica como TypeScript sin compilar.
  transpilePackages: ["@combiaje/shared"],

  // Un build que pasa con errores de tipo es un build que miente.
  // (En Next 16 el lint ya no corre dentro de `next build`: va en CI, por
  //  `pnpm lint`. Eso lo cuida el chat de QA/DevOps.)
  typescript: { ignoreBuildErrors: false },

  // El mapa es WebGL: no hay nada que optimizar en imágenes todavía,
  // pero los iconos de la PWA y las capturas del README sí pasan por aquí.
  images: { formats: ["image/avif", "image/webp"] },

  // Nota: NO declaramos Cache-Control para /_next/static/*. Next ya sirve esos
  // archivos (la fuente incluida) con hash en el nombre e `immutable`, y
  // sobrescribirlo rompe la recarga en caliente en desarrollo.
};

export default nextConfig;
