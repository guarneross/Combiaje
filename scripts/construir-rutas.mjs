#!/usr/bin/env node
/**
 * Convierte las rutas trazadas a mano en datos que la aplicación puede pintar.
 *
 *   data/rutas/<slug>/ruta.json      metadatos de la ruta
 *   data/rutas/<slug>/ida.geojson    puntos de paso del sentido de ida
 *   data/rutas/<slug>/vuelta.geojson puntos de paso del sentido de vuelta
 *
 * Lo que hace con cada sentido:
 *
 *   1. Lee los puntos de paso que dibujaste (pocos, imprecisos, da igual).
 *   2. Se los manda a un motor de ruteo, que devuelve el recorrido real
 *      **por las calles**, respetando sentidos únicos y vueltas prohibidas.
 *   3. Guarda el resultado en caché para no volver a pedirlo si no cambiaste
 *      nada.
 *
 * Al final escribe `apps/web/src/mocks/data/rutas-reales.json`. Si ese archivo
 * tiene rutas, la aplicación las usa **en lugar** de las simuladas.
 *
 * Uso:  pnpm rutas
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = path.join(RAIZ, "data", "rutas");
const DESTINO = path.join(RAIZ, "apps", "web", "src", "mocks", "data", "rutas-reales.json");

/**
 * Motor de ruteo. El servidor público de OSRM sirve para desarrollo: su
 * política prohíbe el uso intensivo, y aquí son un par de peticiones por ruta.
 * El día que esto sea un flujo diario, se autohospeda y se cambia esta URL.
 */
const OSRM = process.env["OSRM_URL"] ?? "https://router.project-osrm.org";

/**
 * Versión de los parámetros de ruteo. **Súbela cada vez que cambie cómo se
 * pide el trazo** (continue_straight, el perfil, el motor).
 *
 * Por qué existe: la caché se nombra con un hash de los puntos de paso. Si solo
 * dependiera de los puntos, cambiar un parámetro de ruteo no invalidaría nada y
 * el script seguiría devolviendo el trazo viejo para siempre — que es
 * exactamente el error que tuvo la versión 1.
 */
const VERSION_RUTEO = 4;

/**
 * Lee la respuesta del motor mostrando **lo que dijo el servidor**.
 *
 * Un 400 a secas no sirve de nada: OSRM manda en el cuerpo un `code` y un
 * `message` que dicen exactamente qué parámetro no le gustó. La versión
 * anterior de este script los tiraba a la basura y dejaba al usuario
 * adivinando. No vuelve a pasar.
 */
async function leerRespuesta(respuesta, donde) {
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    /* algunas respuestas de error no traen JSON */
  }
  if (!respuesta.ok || (cuerpo && cuerpo.code !== "Ok")) {
    const detalle = cuerpo?.message ?? cuerpo?.code ?? `HTTP ${respuesta.status}`;
    const error = new Error(`${donde}: el motor rechazó la petición — ${detalle}`);
    error.codigo = cuerpo?.code ?? String(respuesta.status);
    throw error;
  }
  return cuerpo;
}

const SENTIDOS = [
  { archivo: "ida.geojson", nombre: "Ida", direction: 0, principal: true },
  { archivo: "vuelta.geojson", nombre: "Vuelta", direction: 1, principal: false },
];

/** UUID determinista a partir de un texto: el mismo slug da siempre el mismo id. */
function idDesde(texto) {
  const h = createHash("sha256").update(texto).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), "8" + h.slice(17, 20), h.slice(20, 32)].join("-");
}

/**
 * Quita puntos pegados: un doble clic en el editor deja dos coordenadas
 * idénticas, y el motor de ruteo se confunde o devuelve tramos de cero metros.
 */
function limpiarPuntos(puntos, donde) {
  const limpios = [puntos[0]];
  let quitados = 0;
  for (let i = 1; i < puntos.length; i++) {
    if (longitudM([limpios[limpios.length - 1], puntos[i]]) < 5) { quitados++; continue; }
    limpios.push(puntos[i]);
  }
  if (quitados > 0) console.log(`  · ${donde}: quité ${quitados} punto(s) duplicado(s)`);
  return limpios;
}

/**
 * Avisa de giros de más de 110 grados entre tramos cortos. Casi siempre es un
 * clic mal puesto; a veces es un rodeo real por una colonia. Solo quien conoce
 * la ruta puede decidirlo, así que esto avisa y no corrige.
 */
function avisarRetrocesos(puntos, donde) {
  const rumbo = (a, b) => {
    const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
    return (Math.atan2((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]) * 180) / Math.PI;
  };
  // Ojo: `%` en JavaScript devuelve negativos, así que hay que normalizar a
  // [0, 360) antes de medir el giro. Sin esto salen ángulos de 290 grados.
  const normalizar = (grados) => (((grados % 360) + 360) % 360);

  for (let i = 1; i < puntos.length - 1; i++) {
    const diferencia = rumbo(puntos[i], puntos[i + 1]) - rumbo(puntos[i - 1], puntos[i]);
    const giro = Math.abs(normalizar(diferencia + 180) - 180);
    if (giro > 110) {
      const [lng, lat] = puntos[i];
      console.warn(
        `  ⚠  ${donde}: giro de ${giro.toFixed(0)}° en ${lat.toFixed(4)}, ${lng.toFixed(4)}. ` +
          `¿Es un rodeo real o un clic de más?`,
      );
    }
  }
}

/** Saca la primera LineString de cualquier cosa que exporte un editor de mapas. */
function extraerPuntos(geojson, donde) {
  const candidatos =
    geojson.type === "FeatureCollection" ? geojson.features.map((f) => f.geometry) :
    geojson.type === "Feature" ? [geojson.geometry] : [geojson];

  for (const g of candidatos) {
    if (g?.type === "LineString" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      return g.coordinates.map(([lng, lat]) => [Number(lng), Number(lat)]);
    }
  }
  throw new Error(`${donde}: no encontré una LineString con al menos dos puntos.`);
}

/**
 * **Map matching**: le da tu trazo al motor y pregunta *por qué calles pasó*.
 *
 * Es distinto de planear una ruta. El planificador responde «cómo llego de A a
 * B más rápido», y por eso se va por avenidas que tu camión no usa y hace
 * vueltas en U para alcanzar un punto mal puesto. El emparejador penaliza
 * cualquier desvío de tu línea, así que no puede inventar rodeos.
 *
 * `radiuses` acota cuánto puede moverse cada punto para pegarse a una calle.
 * Con 40 m, un punto no puede saltar a la calle paralela de enfrente. Si algún
 * punto no tiene calle a menos de 40 m, el motor falla — y eso es información
 * útil: ese punto está mal puesto.
 *
 * `confidence` (0 a 1) dice qué tan seguro está del resultado. Por debajo de
 * 0.5 conviene revisar.
 */
async function emparejarConCalles(puntos, donde) {
  const coords = puntos.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const base = `${OSRM}/match/v1/driving/${coords}?geometries=geojson&overview=full&steps=true`;

  // Dos intentos, de más acotado a más permisivo. Algunos servidores públicos
  // no aceptan `radiuses` en /match y responden 400; en ese caso se reintenta
  // sin él antes de darse por vencido.
  const intentos = [`${base}&radiuses=${puntos.map(() => 40).join(";")}`, base];

  let datos = null;
  let ultimoError = null;
  for (const url of intentos) {
    try {
      datos = await leerRespuesta(await fetch(url), donde);
      break;
    } catch (e) {
      ultimoError = e;
      console.warn(`  ⚠  reintentando sin acotar el radio… (${e.codigo ?? "error"})`);
    }
  }
  if (!datos) throw ultimoError;

  if (!datos.matchings?.length) {
    throw new Error(
      `${donde}: el motor no encontró calles que correspondan al trazo. ` +
        `Suele ser un punto que cayó lejos de cualquier calle.`,
    );
  }

  if (datos.matchings.length > 1) {
    console.warn(
      `  ⚠  ${donde}: el trazo se partió en ${datos.matchings.length} pedazos. ` +
        `Suele haber un punto suelto entre ellos; revisa el mapa en las uniones.`,
    );
  }

  const coordsSalida = [];
  const calles = [];
  for (const emparejamiento of datos.matchings) {
    if (emparejamiento.confidence !== undefined && emparejamiento.confidence < 0.5) {
      console.warn(
        `  ⚠  ${donde}: confianza baja (${emparejamiento.confidence.toFixed(2)}). ` +
          `El motor no está seguro de por dónde va. Revísalo con cuidado.`,
      );
    }
    for (const [lng, lat] of emparejamiento.geometry.coordinates) {
      coordsSalida.push([Number(lng), Number(lat)]);
    }
    for (const calle of callesDe(emparejamiento.legs ?? [])) {
      if (calles[calles.length - 1] !== calle) calles.push(calle);
    }
  }
  return { coords: coordsSalida, calles };
}

/**
 * Pide al motor de ruteo el recorrido por calles que pasa por todos los puntos.
 *
 * Sobre `continue_straight`: obliga a salir de cada punto de paso en la misma
 * dirección en que se llegó. Suena bien —evita vueltas en U— pero en la
 * práctica causa el peor defecto de todos: si pusiste un punto justo en una
 * esquina donde la ruta da vuelta, el motor tiene prohibido girar ahí y **da
 * la vuelta a la manzana** para reencauzarse. Por eso va en `false`.
 *
 * Si alguna ruta sale con vueltas en U falsas, pon `"continuarDerecho": true`
 * en su `ruta.json`.
 */
async function pegarACalles(puntos, donde, continuarDerecho = false) {
  const coords = puntos.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url =
    `${OSRM}/route/v1/driving/${coords}` +
    // `steps=true` trae el nombre de cada calle que usó. Es lo que permite
    // revisar el resultado leyendo una lista en vez de entrecerrar los ojos
    // sobre el mapa.
    `?overview=full&geometries=geojson&steps=true&continue_straight=${continuarDerecho}`;

  const datos = await leerRespuesta(await fetch(url), donde);
  if (!datos.routes?.[0]) {
    throw new Error(`${donde}: el motor no devolvió ninguna ruta.`);
  }

  avisarRodeos(datos.routes[0].legs ?? [], puntos, donde);
  return {
    coords: datos.routes[0].geometry.coordinates.map(([lng, lat]) => [Number(lng), Number(lat)]),
    calles: callesDe(datos.routes[0].legs ?? []),
  };
}

/**
 * Lista ordenada de las calles por las que pasó el trazo, sin repetir las
 * consecutivas.
 *
 * Esto es la mejor forma de revisar una ruta: tú sabes de memoria que el camión
 * sube por la 11 Norte y da vuelta en la 14 Poniente. Leer esa lista y ver que
 * dice «16 Poniente» te dice en un segundo lo que mirando el mapa te toma
 * cinco minutos.
 */
function callesDe(tramos) {
  const calles = [];
  for (const tramo of tramos) {
    for (const paso of tramo.steps ?? []) {
      const nombre = paso.name?.trim() || paso.ref?.trim();
      if (!nombre) continue;
      if (calles[calles.length - 1] !== nombre) calles.push(nombre);
    }
  }
  return calles;
}

/**
 * Señala los puntos de paso que provocaron un rodeo.
 *
 * El motor devuelve el recorrido tramo por tramo. Si para cubrir 120 metros en
 * línea recta recorrió 800, es que tu punto cayó del lado equivocado de una
 * avenida, en una lateral, o sobre una calle paralela: el motor dio la vuelta
 * a la manzana para tocarlo. Mover o quitar ese punto arregla el trazo.
 */
function avisarRodeos(tramos, puntos, donde) {
  tramos.forEach((tramo, i) => {
    const recta = longitudM([puntos[i], puntos[i + 1]]);
    if (recta < 40) return;
    const razon = tramo.distance / recta;
    if (razon < 3) return;
    const [lng, lat] = puntos[i + 1];
    console.warn(
      `  ⚠  ${donde}: rodeo entre los puntos ${i} y ${i + 1} — ` +
        `${Math.round(tramo.distance)} m por calle para ${Math.round(recta)} m en línea recta ` +
        `(×${razon.toFixed(1)}). Mueve o quita el punto ${lat.toFixed(5)}, ${lng.toFixed(5)}.`,
    );
  });
}

/** Longitud de una polilínea en metros, aproximación equirrectangular. */
function longitudM(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const latMedia = ((lat1 + lat2) / 2) * (Math.PI / 180);
    total += Math.hypot((lng2 - lng1) * 111320 * Math.cos(latMedia), (lat2 - lat1) * 110540);
  }
  return Math.round(total);
}

/** Validaciones mínimas antes de dar por buena una ruta. */
function revisar(slug, sentido, coords) {
  const avisos = [];
  const largo = longitudM(coords);
  if (largo < 2000) avisos.push(`${largo} m parece muy corta para una ruta de camión`);
  if (largo > 60000) avisos.push(`${(largo / 1000).toFixed(1)} km parece demasiado larga`);

  for (let i = 0; i < coords.length - 1; i++) {
    const salto = longitudM([coords[i], coords[i + 1]]);
    if (salto > 500) { avisos.push(`hay un salto de ${salto} m entre dos puntos seguidos`); break; }
  }
  const fuera = coords.some(([lng, lat]) => lng < -98.6 || lng > -97.8 || lat < 18.7 || lat > 19.4);
  if (fuera) avisos.push("hay puntos fuera del área metropolitana de Puebla");

  for (const aviso of avisos) console.warn(`  ⚠  ${slug} · ${sentido}: ${aviso}`);
  return largo;
}

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No existe ${ORIGEN}. Crea la carpeta y mete tu primera ruta.`);
    process.exit(1);
  }

  const carpetas = (await readdir(ORIGEN, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();

  const concesionarias = new Map();
  const rutas = [];

  for (const slug of carpetas) {
    const base = path.join(ORIGEN, slug);
    const meta = JSON.parse(await readFile(path.join(base, "ruta.json"), "utf8"));
    console.log(`\n▸ ${slug}  ${meta.shortName} · ${meta.longName}`);

    const idConcesionaria = idDesde(`concesionaria:${meta.agency.shortName}`);
    if (!concesionarias.has(idConcesionaria)) {
      concesionarias.set(idConcesionaria, {
        id: idConcesionaria,
        name: meta.agency.name,
        shortName: meta.agency.shortName ?? null,
        type: meta.agency.type,
      });
    }

    const rutaId = idDesde(`ruta:${slug}`);
    const variants = [];
    const geometrias = [];

    for (const sentido of SENTIDOS) {
      const archivo = path.join(base, sentido.archivo);
      if (!existsSync(archivo)) {
        console.log(`  · sin ${sentido.archivo}, me la salto`);
        continue;
      }

      const donde = `${slug}/${sentido.archivo}`;
      const puntos = limpiarPuntos(
        extraerPuntos(JSON.parse(await readFile(archivo, "utf8")), donde),
        donde,
      );
      avisarRetrocesos(puntos, donde);
      const [pLng, pLat] = puntos[0];
      const [uLng, uLat] = puntos[puntos.length - 1];
      console.log(
        `  · ${sentido.nombre}: ${puntos.length} puntos de paso · ` +
          `de ${pLat.toFixed(5)},${pLng.toFixed(5)} a ${uLat.toFixed(5)},${uLng.toFixed(5)}`,
      );
      const huella = createHash("sha256")
        .update(
          JSON.stringify(puntos) +
            (meta.metodo ?? "match") +
            (meta.yaTrazado ? "crudo" : `-v${VERSION_RUTEO}-cs${meta.continuarDerecho === true}`),
        )
        .digest("hex")
        .slice(0, 16);

      const cacheDir = path.join(base, ".cache");
      const cacheArchivo = path.join(cacheDir, `${sentido.direction}-${huella}.json`);

      const metodo = meta.metodo ?? "match";
      let coords;
      let calles = [];
      if (existsSync(cacheArchivo)) {
        coords = JSON.parse(await readFile(cacheArchivo, "utf8"));
        console.log(`  · ${sentido.nombre}: en caché (${coords.length} puntos)`);
      } else if (metodo === "crudo" || meta.yaTrazado) {
        // Tu línea tal cual, sin tocar ningún motor. Imperfecta en las
        // esquinas, pero es exactamente lo que dibujaste.
        coords = puntos;
        console.log(`  · ${sentido.nombre}: trazo crudo, ${coords.length} puntos`);
      } else {
        const verbo = metodo === "ruta" ? "planeando" : "emparejando con";
        process.stdout.write(`  · ${sentido.nombre}: ${verbo} las calles… `);
        try {
          const resultado =
            metodo === "ruta"
              ? await pegarACalles(puntos, donde, meta.continuarDerecho === true)
              : await emparejarConCalles(puntos, donde);
          coords = resultado.coords;
          calles = resultado.calles;
          console.log(`${coords.length} puntos`);
        } catch (e) {
          // Que el motor falle no debe dejarte sin mapa. Se usa tu línea tal
          // cual y se avisa: un trazo crudo correcto vale más que ninguno.
          console.log("falló");
          console.warn(`  ⚠  ${e.message}`);
          console.warn(
            `  → Uso tu línea tal cual (modo crudo). Para fijarlo y dejar de ` +
              `intentarlo, pon "metodo": "crudo" en ruta.json.`,
          );
          coords = puntos;
        }
      }

      await mkdir(cacheDir, { recursive: true });
      await writeFile(cacheArchivo, JSON.stringify(coords));

      if (calles.length > 0) {
        const archivoCalles = path.join(base, `${sentido.nombre.toLowerCase()}-calles.txt`);
        await writeFile(
          archivoCalles,
          `Calles por las que pasó el trazo de ${slug} · ${sentido.nombre}\n` +
            `Generado ${new Date().toISOString().slice(0, 10)}. Compáralo con lo que sabes.\n\n` +
            calles.map((c, i) => `${String(i + 1).padStart(3)}. ${c}`).join("\n") +
            "\n",
        );
        console.log(`    ${calles.length} calles → ${sentido.nombre.toLowerCase()}-calles.txt`);
        console.log(`    ${calles.slice(0, 6).join(" → ")}${calles.length > 6 ? " → …" : ""}`);
      }

      const largo = revisar(slug, sentido.nombre, coords);
      variants.push({
        id: idDesde(`variante:${slug}:${sentido.direction}`),
        routeId: rutaId,
        name: sentido.nombre,
        direction: sentido.direction,
        lengthM: largo,
        isPrimary: sentido.principal,
      });
      geometrias.push(coords);
    }

    if (variants.length === 0) {
      console.warn(`  ⚠  ${slug} no tiene ningún sentido trazado. La omito.`);
      continue;
    }

    const denominations = (meta.denominaciones ?? []).map((d) => ({
      shortName: d.shortName,
      longName: d.longName ?? null,
      colors: d.colores ?? [meta.color],
      basin: d.cuenca ?? null,
      from: d.desde ?? null,
      until: d.hasta ?? null,
      current: d.vigente === true,
      source: d.fuente ?? null,
    }));

    // La identidad visible sale de la denominación vigente, no de los campos
    // sueltos de arriba. Si no fuera así, anotar el número nuevo de la SMT en
    // `denominaciones` y olvidar cambiar `shortName` dejaría la ficha
    // mostrando el número viejo como si siguiera siendo el bueno. Con esto,
    // basta con marcar `vigente: true` donde corresponda.
    const vigente = denominations.find((d) => d.current);
    const identidad = vigente
      ? {
          shortName: vigente.shortName,
          longName: vigente.longName ?? meta.longName,
          color: vigente.colors[0] ?? meta.color,
          colorSecondary: vigente.colors[1] ?? null,
          basin: vigente.basin ?? meta.cuenca ?? null,
        }
      : {
          shortName: meta.shortName,
          longName: meta.longName,
          color: meta.color,
          colorSecondary: meta.colorSecundario ?? null,
          basin: meta.cuenca ?? null,
        };

    if (vigente && vigente.shortName !== meta.shortName) {
      console.warn(
        `  ⚠  ${slug}: la denominación vigente dice «${vigente.shortName}» y el ` +
          `encabezado dice «${meta.shortName}». Mando la vigente; ` +
          `actualiza "shortName" en ruta.json para que no confunda.`,
      );
    }

    rutas.push({
      id: rutaId,
      slug,
      shortName: identidad.shortName,
      longName: identidad.longName,
      color: identidad.color,
      textColor: meta.textColor ?? "#FFFFFF",
      colorSecondary: identidad.colorSecondary,
      basin: identidad.basin,
      denominations,
      fareCents: meta.fareCents ?? null,
      status: meta.status ?? "draft",
      agency: concesionarias.get(idConcesionaria),
      dataSource: meta.dataSource ?? "manual",
      updatedAt: new Date().toISOString(),
      variants,
      ratingStats: null,
      geometrias,
    });
  }

  await writeFile(
    DESTINO,
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        aviso: "Generado por scripts/construir-rutas.mjs. No editar a mano.",
        concesionarias: [...concesionarias.values()],
        rutas,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    rutas.length === 0
      ? "\nNo hay rutas trazadas todavía. La aplicación seguirá usando las simuladas."
      : `\n✓ ${rutas.length} ruta(s) escritas. Corre \`pnpm dev\` y ábrelas en el mapa.`,
  );
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
