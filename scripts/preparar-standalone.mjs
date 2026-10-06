#!/usr/bin/env node
/**
 * Completa el paquete `standalone` de Next.
 *
 * Con `output: "standalone"`, Next arma en `.next/standalone` un servidor
 * autocontenido con solo las dependencias que de verdad se usan. Pero **no
 * copia dentro ni `public/` ni `.next/static/`**: están documentados como paso
 * manual. Si se sube tal cual, el sitio carga sin estilos, sin fuentes, sin
 * iconos y sin el worker de los mocks — y parece un problema de CSS cuando en
 * realidad faltan archivos.
 *
 * Esto lo arregla en cada build, en Windows y en el servidor por igual (nada
 * de `cp -r`, que en Windows no existe).
 *
 * En un monorepo, `outputFileTracingRoot` apunta a la raíz del repo, así que
 * la aplicación queda en `.next/standalone/apps/web/`.
 */

import { cp, access, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const web = join(raiz, "apps", "web");
const destino = join(web, ".next", "standalone", "apps", "web");

async function existe(ruta) {
  try {
    await access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function copiar(origen, destinoFinal, etiqueta) {
  if (!(await existe(origen))) {
    console.warn(`  ⚠  no encontré ${etiqueta}; lo salto`);
    return;
  }
  await mkdir(dirname(destinoFinal), { recursive: true });
  await cp(origen, destinoFinal, { recursive: true });
  console.log(`  · ${etiqueta} copiado`);
}

if (!(await existe(join(web, ".next", "standalone")))) {
  console.log("standalone: no existe .next/standalone, no hay nada que completar.");
  process.exit(0);
}

console.log("standalone: completando el paquete autocontenido");
await copiar(join(web, "public"), join(destino, "public"), "public/");
await copiar(join(web, ".next", "static"), join(destino, ".next", "static"), ".next/static/");
console.log(`✓ listo. Se arranca con: node ${join("apps", "web", "server.js")}`);
