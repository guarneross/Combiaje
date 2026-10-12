#!/usr/bin/env node
/**
 * Crea la carpeta de una ruta nueva, lista para recibir los GeoJSON.
 *
 *   pnpm ruta:nueva ruta-72-centro-la-margarita "72" "Centro – La Margarita"
 *
 * Existe para que agregar una ruta no empiece por copiar `_ejemplo/` y borrar
 * a mano los comentarios: eso se olvida, y un `_comentarios` olvidado o un
 * color repetido se notan hasta que el mapa ya está mal.
 *
 * No toca la red ni el trazo. Solo deja la carpeta y el `ruta.json`.
 */

import { mkdir, writeFile, readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const RUTAS = path.join(RAIZ, "data", "rutas");

/**
 * Colores distinguibles entre sí sobre el mapa claro y el oscuro. No es la
 * paleta de la marca: es para que dos rutas encimadas no se confundan.
 */
const PALETA = [
  "#E11D48", // rojo
  "#2563EB", // azul
  "#059669", // verde
  "#D97706", // ámbar
  "#7C3AED", // violeta
  "#0891B2", // cian
  "#DB2777", // rosa
  "#65A30D", // lima
  "#EA580C", // naranja
  "#4F46E5", // índigo
];

const [slug, shortName, ...resto] = process.argv.slice(2);
const longName = resto.join(" ").trim();

if (!slug || !shortName || !longName) {
  console.error(`
Uso:
  pnpm ruta:nueva <slug> <numero> <nombre largo>

Ejemplo:
  pnpm ruta:nueva ruta-72-centro-la-margarita 72 "Centro – La Margarita"

  · slug    minúsculas, números y guiones. Es la URL: /rutas/<slug>
  · numero  como viene rotulado en el parabrisas
  · nombre  origen – destino, con guion largo (–)
`);
  process.exit(1);
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`✗ «${slug}» no sirve como slug: solo minúsculas, números y guiones.`);
  console.error(`  Prueba con algo como: ruta-${shortName.toLowerCase()}-origen-destino`);
  process.exit(1);
}

const destino = path.join(RUTAS, slug);

async function existe(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (await existe(destino)) {
  console.error(`✗ Ya existe data/rutas/${slug}/. No la toco.`);
  console.error(`  Si quieres rehacerla, bórrala tú y vuelve a correr esto.`);
  process.exit(1);
}

/** Colores que ya están en uso, para no repetir. */
const usados = new Set();
if (await existe(RUTAS)) {
  for (const entrada of await readdir(RUTAS, { withFileTypes: true })) {
    if (!entrada.isDirectory() || entrada.name.startsWith("_")) continue;
    try {
      const meta = JSON.parse(await readFile(path.join(RUTAS, entrada.name, "ruta.json"), "utf8"));
      if (meta.color) usados.add(meta.color.toUpperCase());
    } catch {
      /* carpeta a medias: no estorba */
    }
  }
}

const color = PALETA.find((c) => !usados.has(c)) ?? PALETA[usados.size % PALETA.length];

const hoy = new Date().toISOString().slice(0, 10);

const ruta = {
  shortName,
  longName,
  color,
  textColor: "#FFFFFF",
  fareCents: null,
  status: "draft",
  dataSource: "manual",
  agency: { name: "Por identificar", shortName: null, type: "urbano" },
  notas: `Trazada el ${hoy}. PENDIENTE: tarifa, concesionaria, verificar en campo y trazar la vuelta.`,
  metodo: "match",
  colorSecundario: null,
  cuenca: null,
  denominaciones: [
    {
      shortName,
      longName,
      colores: [color],
      cuenca: null,
      desde: null,
      hasta: null,
      vigente: true,
      fuente: "nomenclatura anterior",
    },
  ],
};

await mkdir(destino, { recursive: true });
await writeFile(path.join(destino, "ruta.json"), `${JSON.stringify(ruta, null, 2)}\n`, "utf8");

console.log(`
✓ Lista data/rutas/${slug}/
    ruta.json   creado, color ${color}

Ahora:

  1. Abre https://geojson.io, dibuja la IDA con la herramienta de línea
     y guárdala como  data/rutas/${slug}/ida.geojson
  2. Repite para la VUELTA (es otro camino, no el mismo al revés)
     y guárdala como  data/rutas/${slug}/vuelta.geojson
  3. pnpm rutas        pega los puntos a las calles
  4. pnpm dev          míralo en el mapa
  5. git add -A && git commit -m "Ruta ${shortName}" && git push
                       y en dos minutos está en combiaje.joscian.com

Si el trazo sale con rodeos, el detalle está en data/rutas/README.md.
`);
