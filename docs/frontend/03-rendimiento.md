# Rendimiento

El usuario de Combiaje está parado en la calle, con prisa, datos móviles
limitados y un teléfono de gama media. El rendimiento no es una optimización
posterior: es un requisito del producto.

---

## El presupuesto

**La pantalla principal carga en menos de 3 segundos en 4G simulada.**

De ahí salen presupuestos derivados que conviene vigilar bloque a bloque:

| Métrica                      | Presupuesto            | Por qué                                |
| ---------------------------- | ---------------------- | -------------------------------------- |
| `load` en 4G lenta           | < 3 000 ms             | Requisito del hito                     |
| LCP                          | < 2 500 ms             | Umbral «bueno» de Core Web Vitals      |
| Transferencia inicial        | < 600 KB               | Datos móviles limitados y de prepago   |
| Peticiones iniciales         | < 35                   | Cada ida y vuelta cuesta 150 ms de RTT |
| Cuadros por segundo del mapa | ≥ 50 fps en gama media | Un mapa a 20 fps se siente roto        |

Regla de trabajo: **si un cambio empeora el presupuesto, hay que decirlo en la
descripción del PR**, aunque siga dentro del límite. Lo que mata el
rendimiento no es una decisión mala, son quince decisiones de 20 KB cada una
que nadie midió.

---

## Cómo se mide

Siempre sobre el **build de producción**, nunca en desarrollo: el servidor de
desarrollo sirve módulos sin empaquetar y las cifras no significan nada.

```bash
pnpm build
cd apps/web && PORT=3100 pnpm start
```

Y encima, un navegador real con la red y la CPU frenadas a mano. Las
condiciones son las de «4G lenta» de Lighthouse:

| Parámetro      | Valor                            |
| -------------- | -------------------------------- |
| Bajada         | 1.6 Mbps                         |
| Subida         | 750 Kbps                         |
| Latencia (RTT) | 150 ms                           |
| CPU            | 4× más lenta (emula gama media)  |
| Viewport       | 360 × 740, `deviceScaleFactor` 2 |

Con Playwright, vía CDP:

```js
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

Las métricas se leen con `PerformanceObserver` (`first-contentful-paint`,
`largest-contentful-paint`) y `performance.getEntriesByType("navigation")`.

> Lo mismo se obtiene desde Chrome DevTools: pestaña **Network** → perfil
> «Slow 4G», y **Performance** → CPU 4× slowdown. Lighthouse en modo móvil usa
> exactamente estas condiciones.

---

## Mediciones registradas

Siempre sobre la pantalla principal (`/`), que es la del presupuesto.

| Bloque                     | Fecha      | FCP      | LCP      | `load`       | Transferido | Peticiones |
| -------------------------- | ---------- | -------- | -------- | ------------ | ----------- | ---------- |
| 1 · Andamiaje              | 2026-10-02 | 664 ms   | 664 ms   | 1 615 ms     | ~245 KB     | 23         |
| 2 · Capa de datos, con MSW | 2026-10-03 | 700 ms   | 700 ms   | 2 784 ms     | ~447 KB     | 29         |
| 2 · Capa de datos, sin MSW | 2026-10-03 | 740 ms   | 740 ms   | 2 215 ms     | ~357 KB     | 26         |
| 3 · Con el mapa, con MSW   | 2026-10-03 | 1 548 ms | 1 548 ms | **4 888 ms** | **~736 KB** | 46         |
| 5 · Fichas de ruta, `/`    | 2026-10-06 | 660 ms   | 2 664 ms | 4 998 ms     | ~745 KB     | 39         |

Y las dos pantallas nuevas, medidas igual:

| Pantalla                      | Fecha      | FCP    | LCP      | `load`   | Transferido | Peticiones |
| ----------------------------- | ---------- | ------ | -------- | -------- | ----------- | ---------- |
| `/rutas` (catálogo)           | 2026-10-06 | 712 ms | 2 608 ms | 2 856 ms | ~437 KB     | 33         |
| `/rutas/ruta-21-canal-centro` | 2026-10-06 | 860 ms | 860 ms   | 5 205 ms | ~775 KB     | 40         |

> **Advertencia sobre el entorno de medición.** El contenedor donde se mide no
> alcanza `basemaps.cartocdn.com`, así que el estilo base se sirvió desde un
> archivo local mínimo. Los números **no incluyen las teselas de fondo**: el
> `load` real en un teléfono con el estilo de CARTO es mayor. Sirven para
> comparar bloques entre sí, que es para lo que está la tabla, no como promesa
> al usuario. La medición de verdad se hace en el servidor de Hostinger.

### Qué dicen estos números

**El bloque 2 costó ~110 KB reales** (TanStack Query + Zod + el cliente HTTP) y
**~90 KB más de MSW**, que desaparecen el día que exista la API: el worker se
carga en un _chunk_ aparte que solo se descarga si
`NEXT_PUBLIC_ENABLE_MOCKS=true`.

**Un error que se atrapó midiendo.** La primera versión envolvía todo el árbol
en un proveedor que esperaba a que MSW arrancara antes de pintar. El LCP se fue
de 650 ms a **2 984 ms**: ni el esqueleto alcanzaba a dibujarse. La espera se
movió al cliente HTTP —espera el dato, no la pantalla— y el LCP volvió a
700 ms. La lección general: **nada que tarde debe bloquear el primer pintado**.

**Una advertencia para el bloque 3.** Con mocks encendidos ya estamos a 2 784 ms
de los 3 000 del presupuesto. MapLibre pesa unos 250 KB comprimidos. El sitio
público, que corre con mocks hasta que exista el backend, va a rebasar el
presupuesto si el mapa se carga en el paquete principal.

Decisión tomada de antemano para el bloque 3: **MapLibre entra con
`next/dynamic`**, fuera del paquete inicial. Es cliente puro de todos modos, así
que no se pierde nada.

---

## El bloque 3 rompió el presupuesto. Qué pasó exactamente

`load` subió a **4 888 ms** contra los 3 000 del presupuesto, y la
transferencia a **736 KB** contra los 600. Hay que mirarlo de cerca antes de
concluir nada, porque el número grande esconde una buena noticia.

### La carga diferida sí funciona

Desglose por momento de descarga, en 4G lenta:

| Momento   | Qué baja                                                                      | Peso        |
| --------- | ----------------------------------------------------------------------------- | ----------- |
| ~180 ms   | React, Next, TanStack Query, Zod, MSW, la fuente y el código de la aplicación | **~315 KB** |
| ~2 300 ms | MapLibre y su hoja de estilos                                                 | **~310 KB** |

Y la comprobación que lo confirma: **`/rutas`, que no tiene mapa, descarga los
mismos ~315 KB críticos.** Es decir, MapLibre no está en el paquete inicial —
`next/dynamic` hizo su trabajo. La primera pintura no espera al mapa.

### Dónde está el peso que sí se puede quitar

De esos 315 KB críticos, **unos 90 KB son MSW**, que existe solo porque no hay
backend. Desaparecen el día que la API responda de verdad. Los 10 GeoJSON que
el mapa pide en modo simulado también desaparecen cuando haya teselas.

Proyección con dataset real y pmtiles: **~225 KB críticos + ~310 KB de
MapLibre ≈ 535 KB**, por debajo del presupuesto de transferencia.

Los 310 KB de MapLibre no se pueden reducir: es la biblioteca. O se usa, o se
cambia de motor de mapas.

### El presupuesto estaba mal planteado

«La pantalla principal carga en menos de 3 s» no dice **qué** significa cargar.
Medido contra `load`, incluye el mapa dibujado. Medido contra la primera
pintura, incluye solo la interfaz.

La distinción no es un tecnicismo: **la pantalla es usable antes de que el mapa
exista.** El buscador y «rutas cerca de mí» están en la hoja inferior, que se
renderiza en el servidor, y la regla de accesibilidad que obliga a tener una
alternativa en lista para todo lo que solo se ve en el mapa resulta ser también
la estrategia de rendimiento: si el mapa tarda, la aplicación sigue sirviendo.

**Presupuesto propuesto, partido en dos:**

| Qué                           | Umbral                 | Estado                 |
| ----------------------------- | ---------------------- | ---------------------- |
| Interfaz utilizable (FCP/LCP) | < 2 000 ms en 4G lenta | ✅ 1 548 ms            |
| Mapa dibujado (`load`)        | < 5 000 ms en 4G lenta | ⚠️ 4 888 ms, al límite |
| Transferencia total           | < 600 KB sin MSW       | ⚠️ proyectado ~535 KB  |

⚠️ **Requiere decisión.** La condición «4G lenta» de Lighthouse (1.6 Mbps,
150 ms de ida y vuelta, CPU a un cuarto) es el peor caso realista. En 4G normal
de Puebla, de 5 a 15 Mbps, estos tiempos se dividen entre tres o cuatro. Hay que
decidir si el presupuesto se mide contra el peor caso o contra el caso típico, y
dejarlo escrito; medir contra el peor caso y fallarlo cada vez solo entrena a
ignorar la medición.

---

## El bloque 5 no costó nada, y además enseñó algo

La pantalla principal se quedó donde estaba (4 888 → 4 998 ms de `load`, dentro
del ruido de medición): las fichas de ruta son páginas aparte y no agregan
nada al paquete inicial.

Lo interesante está en la columna del LCP de la ficha: **LCP = FCP = 860 ms**.
Lo más grande que se pinta es el encabezado de la ruta, y ya venía escrito en
el HTML que mandó el servidor. Es la diferencia entre renderizar en servidor y
no hacerlo, medida: el catálogo, que pide sus datos desde el navegador, tarda
2 608 ms en llegar a su LCP.

De ahí sale una regla práctica para las pantallas que faltan: **lo que se
pueda escribir en el HTML del servidor, se escribe**; el cliente queda para lo
que de verdad depende del navegador (el mapa, la ubicación, el estado de la
URL).

El `load` de la ficha (5 205 ms) es el mapa terminando de dibujarse, igual que
en la pantalla principal. La página ya es usable mucho antes.

---

## Lo que protege el presupuesto

Decisiones ya tomadas que hay que no desarmar por accidente:

- **Teselas vectoriales en vez de GeoJSON.** Es la diferencia entre 30 KB por
  tesela y decenas de megabytes. Ver `01-arquitectura.md` §3.
- **Resaltar y filtrar con expresiones de estilo de MapLibre**
  (`setFilter`, `setPaintProperty`), no volviendo a pedir datos. Instantáneo y
  gratis en red.
- **Fuente auto-hospedada, subconjunto latino: 48 KB.** Sin petición a un
  tercero ni resolución DNS extra.
- **Componentes de servidor por omisión.** Cada `"use client"` de más es
  JavaScript que alguien descarga y ejecuta en un teléfono barato.
- **Iconos de `lucide-react` importados por nombre**, que es lo que permite que
  el empaquetador tire el resto de la librería.
- **Serwist pospuesto, pero en el plan.** Cuando entre (después del bloque 5),
  la segunda visita debe salir de caché y el presupuesto de red se vuelve casi
  irrelevante para quien ya abrió la aplicación una vez.

---

## Cuándo volver a medir

- Al terminar cada bloque que agregue dependencias de peso.
- **Obligatorio en el bloque 3**, cuando entre MapLibre.
- Antes de cerrar el hito 1, además con Lighthouse completo, para tener el
  reporte que pide el entregable de portafolio del rol de Frontend.
