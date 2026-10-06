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

  // MSW se deja FUERA del empaquetado del servidor.
  //
  // `@mswjs/interceptors` lee un archivo `.wasm` con `readFileSync`. Al
  // empaquetarlo, esa lectura queda con la ruta absoluta de la carpeta donde
  // se compiló, y el despliegue de Hostinger publica el build en otra carpeta
  // (`hbuilds/versions/<id>/`): el archivo ya no está ahí y el servidor no
  // arranca —500 en todo el sitio—. Marcándolo como externo, Next lo copia
  // dentro de `standalone/node_modules` y lo carga en tiempo de ejecución.
  //
  // Esto desaparece el día que `NEXT_PUBLIC_ENABLE_MOCKS` sea `false`.
  serverExternalPackages: ["msw", "@mswjs/interceptors"],

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
