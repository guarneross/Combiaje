# Arquitectura del frontend

## 1. Dónde encaja `apps/web`

> **Cambio de arquitectura, 3 de octubre de 2026.** El proyecto pasó de cuatro
> personas a una. La API separada en NestJS se descartó: ahora vive como Route
> Handlers de Next en este mismo repo y despliegue. Las URLs del contrato no
> cambian, así que el cliente HTTP, los esquemas y MSW siguen igual.
> El razonamiento completo está en `combiaje/01-plan-solo.md`.

```
combiaje/
├─ apps/
│  └─ web/
│     └─ src/
│        ├─ app/api/v1/     ← la API: Route Handlers + Drizzle + PostGIS
│        └─ …               ← la aplicación
├─ packages/
│  ├─ shared/         tipos + esquemas Zod del contrato
│  └─ config/         tsconfig y eslint compartidos
└─ docs/
   ├─ frontend/       esto
   └─ datos/          cómo se levanta el dataset
```

`packages/shared` sigue siendo la frontera, aunque ya no separe a dos personas:
**los tipos de la API se declaran ahí y se consumen aquí.** Redeclararlos en
`apps/web` es la forma más rápida de que, el día que cambie el esquema, nada
deje de compilar y nadie se entere.

La disciplina del contrato se conserva por la misma razón: evita que el esquema
se vuelva un accidente. Lo que cambia es que las propuestas marcadas
«⚠️ Requiere aprobación de Arquitectura» ahora son decisiones tuyas, que se
anotan en `docs/frontend/04-contrato.md` antes de implementarlas.

---

## 2. Estructura de `apps/web`

```
apps/web/
├─ src/
│  ├─ app/                        Rutas del App Router
│  │  ├─ layout.tsx               html, fuentes, metadata, providers, AppShell
│  │  ├─ globals.css              Tailwind v4 + tokens de color + utilidades
│  │  ├─ page.tsx                 "/" — el mapa. No es un landing.
│  │  ├─ loading.tsx              Esqueleto mientras carga un segmento
│  │  ├─ error.tsx                Frontera de error (cliente, con reintento)
│  │  ├─ not-found.tsx            404
│  │  ├─ manifest.ts              Manifest de la PWA
│  │  ├─ icon.svg · apple-icon.png
│  │  └─ rutas/ planear/ unidades/ perfil/
│  ├─ components/
│  │  ├─ ui/                      shadcn/ui, copiados al repo
│  │  ├─ layout/                  AppShell, MainNav, TopBar, ThemeToggle
│  │  ├─ feedback/                EmptyState, ErrorState, esqueletos
│  │  └─ map/                     (bloque 3) CombiajeMap y sus capas
│  ├─ lib/
│  │  ├─ utils.ts                 cn(), formatDistance(), walkingMinutes()
│  │  ├─ env.ts                   variables de entorno validadas con Zod
│  │  └─ constants.ts             centro de Puebla, zooms, bbox, atribución
│  ├─ providers/
│  │  ├─ app-providers.tsx        punto único de composición de proveedores
│  │  └─ theme-provider.tsx
│  └─ styles/
│     ├─ fonts.ts                 next/font/local
│     └─ fonts/                   InterVariable-latin.woff2 (48 KB)
└─ public/icons/                  iconos de la PWA
```

### Por qué cada cosa está donde está

- **`components/ui/` no se edita a mano sin motivo.** Son componentes de
  shadcn/ui copiados al repo. Se pueden modificar —de hecho ya se modificaron,
  ver §4— pero cada cambio debe quedar comentado en el propio archivo, porque
  si no, nadie sabe qué es nuestro y qué viene de la plantilla.
- **`feedback/` existe para que los tres estados no se improvisen.** Cada
  pantalla que carga datos usa `RouteListSkeleton`, `EmptyState` y `ErrorState`.
  Que estén juntos hace obvio cuando falta uno.
- **`providers/app-providers.tsx` es el único lugar donde se componen
  proveedores de cliente.** Sin esto, `layout.tsx` se va llenando de
  `"use client"` por goteo y de pronto media aplicación se renderiza en el
  navegador sin que nadie lo decidiera.
- **`lib/constants.ts` es solo de presentación.** Las constantes del dominio
  (paleta oficial de colores de ruta, radios del contrato) son de
  `packages/shared`.

---

## 3. La decisión que sostiene el mapa: teselas vectoriales

Las rutas **no** se cargan como GeoJSON. Con 100 rutas, el GeoJSON completo son
decenas de megabytes: la aplicación muere en un teléfono real. Las teselas son
~30 KB cada una y solo llegan las del área visible.

### De servidor de teselas a archivo estático

> **Cambio del 3 de octubre de 2026.** Con una sola persona y rutas que cambian
> cada varias semanas, **no hace falta un servidor de teselas**.

Se genera un archivo `rutas.pmtiles` con `tippecanoe` cada vez que cambia el
dataset, se sube a Supabase Storage, y MapLibre lo lee por rangos HTTP. Pesa
unos pocos megas. Desaparecen el endpoint `ST_AsMVT`, su caché, su latencia y
su ruta caliente en el servidor — y el mapa base ya usa pmtiles, así que es la
misma técnica dos veces en lugar de dos técnicas distintas.

`GET /tiles/routes/{z}/{x}/{y}.mvt` queda **archivado en el contrato**: si algún
día hay miles de rutas o datos en tiempo real, se reactiva sin tocar el cliente.
`<CombiajeMap>` encapsula de qué fuente salen los trazos, así que ninguna
pantalla se entera de la diferencia.

Consecuencias que hay que aprovechar, no sufrir:

- El color sale de la tesela: `"line-color": ["get", "color"]`.
- Resaltar o filtrar una ruta es un `setFilter` o un `setPaintProperty`.
  **Instantáneo, sin tocar la red.** Nunca volver a pedir datos para cambiar
  qué se ve resaltado.
- `GET /routes/:slug/geojson` se usa solo para dos cosas: superponer una ruta
  concreta con más detalle, y calcular el encuadre (`fitBounds`).

---

## 3 bis. La capa de datos

### Las tres cosas que hace el cliente HTTP

`lib/api/client.ts` no es un `fetch` con la URL base pegada. Hace tres cosas
que vale la pena no perder:

1. **Valida toda respuesta contra su esquema Zod.** Si el backend cambia un
   campo, falla ahí con un mensaje claro en vez de propagar `undefined` hasta
   que una pantalla muestre «NaN km» y nadie sepa por qué. Es la defensa contra
   la deriva entre los mocks y la API real.
2. **Pone un tiempo límite de 10 s.** En 4G, una petición colgada para siempre
   es peor que una que falla: la que falla al menos se puede reintentar.
3. **Normaliza los errores** a `ApiError` con cinco tipos —`network`,
   `timeout`, `client`, `server`, `contract`—, y de ahí sale la política de
   reintento y el mensaje que ve el usuario. Reintentar un 404 no lo convierte
   en 200.

### Reintentos: uno, y rápido

Medido: con dos reintentos y espera exponencial de hasta 8 s, el usuario se
queda ocho segundos mirando un esqueleto antes de enterarse de que algo falló.
La política quedó en **un reintento con espera de 800 ms**, y luego el estado
de error con su botón. Él decide si insiste.

Tampoco se vuelve a pedir nada al recuperar el foco de la pestaña
(`refetchOnWindowFocus: false`): gastar datos del usuario sin que los pida es
una decisión, y la tomamos al revés. Lo que sí se recupera es lo que falló
cuando vuelve la conexión.

### Claves de caché y el temblor del GPS

El GPS de un celular tiembla unos metros aunque el usuario esté quieto. Sin
redondear, cada lectura sería una clave de caché distinta y pediríamos
`/nearby` una y otra vez por nada. Las coordenadas se redondean a **cuatro
decimales (~11 m)** antes de entrar en la clave.

### MSW: por qué el arranque vive en `instrumentation-client.ts`

El paquete `msw` publica `msw/browser` con la condición `"node": null`: a
propósito, resolverlo en un entorno de servidor es un error. Next compila cada
componente de cliente **dos veces** —para el navegador y para el renderizado en
servidor—, así que importar `msw/browser` desde un componente rompe el build
con «Module not found: Can't resolve 'msw/browser'».

`instrumentation-client.ts` solo se empaqueta para el navegador y corre antes
de que hidrate la aplicación. Deja una promesa en
`window.__combiajeMocksListos`, y **el cliente HTTP la espera antes de la
primera petición**. La espera va en el transporte, no envolviendo el render:
ver `03-rendimiento.md` para lo que pasó cuando estaba al revés.

### Los mocks no son amables

Un mock que siempre responde rápido, lleno y correcto produce una aplicación
que se cae el primer día. Los escenarios (`?simular=vacio|error|lento`) existen
para poder construir —y ver con los ojos— los tres estados obligatorios.

Los datos simulados están marcados en el propio archivo: **no son el dataset
real** y nada de ahí debe acabar en el GTFS que se publique bajo ODbL. Los
trazos son líneas entre puntos de referencia conocidos del corredor
CAPU ↔ Centro ↔ Angelópolis, no recorridos reales.

---

## 3 ter. Las pantallas de ruta (`/rutas` y `/rutas/[slug]`)

### La ficha es de servidor, y eso tiene consecuencias

`/rutas/[slug]` es la página que tiene que salir cuando alguien busca
«ruta 21 Puebla» en Google. Por eso su contenido —número, nombre, tarifa,
longitud, sentidos, denominaciones, origen del dato— se renderiza **en el
servidor** y viaja en el HTML inicial. Lo único de cliente es el mapa, en
`<RouteMapPanel>`.

Para que eso funcione con el backend todavía inexistente, MSW tiene que
interceptar también **en el servidor**: `src/instrumentation.ts` levanta
`setupServer` cuando `NEXT_PUBLIC_ENABLE_MOCKS=true` y el runtime es Node.
Sin eso la página se renderizaba vacía y «arreglarla» habría significado
volverla de cliente, que es justo lo que no queremos.

Se mide solo: en la ficha, **LCP = FCP** (ver `03-rendimiento.md`), porque lo
más grande que se pinta ya venía escrito en el HTML.

### `notFound()` tiene que responder 404 de verdad

`cargarRuta()` solo convierte en «no encontrada» un **404 de la API**;
cualquier otro error se vuelve a lanzar, para que un backend caído no se
disfrace de ruta inexistente.

Y para que el 404 llegue como 404 —no como 200 con cara de 404— no puede
haber un `Suspense` por encima que obligue a Next a mandar el HTML antes de
tiempo. De ahí la regla:

> **Los límites de `Suspense` van en la pantalla que los necesita, nunca en
> `app/loading.tsx`.**

Hoy los tiene `app/page.tsx` (porque `<PantallaMapa>` lee la URL con nuqs, y
eso usa `useSearchParams()`) y `app/rutas/page.tsx` (por lo mismo con
`<RouteCatalog>`). La ficha no tiene ninguno, y por eso puede contestar 404.

`app/rutas/[slug]/not-found.tsx` da el mensaje concreto («esta ruta todavía no
está en Combiaje, puede que haya cambiado de número con la renumeración») en
vez del genérico de la aplicación.

### Un solo mapa por pantalla

Esconder un mapa con `hidden lg:block` lo esconde pero **no lo desmonta**: eran
dos instancias de MapLibre, dos contextos WebGL y dos descargas del estilo en
un teléfono que solo iba a ver una. Dos reglas:

- Cuando el mismo mapa cambia de lugar según el tamaño (la ficha), se monta
  **una vez** y lo coloca CSS: `flex` en móvil, `grid` de dos columnas en
  escritorio.
- Cuando el mapa solo existe en escritorio (el catálogo), se usa
  `<RouteMapPanel soloDesdeLg>`, que consulta `matchMedia` con
  `useSyncExternalStore` y **no lo monta** por debajo de `lg`.

Verificado contando `<canvas>`: móvil `/rutas` → 0, móvil ficha → 1,
escritorio ambas → 1.

### El relleno del encuadre lo pone la pantalla, no el mapa

`<CombiajeMap>` recibe `relleno` (arriba/abajo/izquierda/derecha en píxeles):
es lo que **esa pantalla** tapa con sus propios controles. La principal declara
280 px abajo por la hoja; la ficha no declara nada y usa el valor base.

Además el mapa **recorta** el relleno a lo que cabe en su contenedor. Sin eso,
heredar los 280 px de la pantalla principal en un mapa de 208 px de alto dejaba
la ruta diminuta y fuera de cuadro: MapLibre no valida que el relleno quepa.

### El mapa no decide qué dibuja: la pantalla sí

`<CombiajeMap>` recibe `rutasVisibles`, una lista de slugs. `[]` deja el mapa
limpio, `null` dibuja todas. El mapa solo descarga la geometría de lo que esa
lista pide.

Antes no existía: el mapa montaba, pedía el GeoJSON de **todo el catálogo** y lo
pintaba, ida y vuelta de cada ruta. Con dos rutas trazadas la pantalla
principal ya abría con un nudo encima del centro que no contestaba ninguna
pregunta; con veinte habría sido ilegible, y además eran veinte descargas que
nadie pidió.

De ahí salen tres reglas:

| Pantalla | Qué dibuja | Sentido |
|---|---|---|
| Principal (`/`) | nada al abrir; después, las rutas que te llevan a tu destino, o la que elegiste | solo ida |
| Catálogo (`/rutas`) | la red completa — es la vista de «ver todo», a la que se entra a propósito | solo ida |
| Ficha (`/rutas/[slug]`) | esa ruta y ninguna más | ida y vuelta |

**Un solo sentido por omisión.** Ida y vuelta recorren casi las mismas calles:
pintar las dos duplica cada línea y no dice nada nuevo. La única pantalla donde
las dos juntas tienen sentido es la ficha, porque ahí el recorrido *es* el tema.

### Desfase: por qué dos rutas en la misma avenida se ven

En Puebla casi todo pasa por el centro. Dos trazos sobre la misma calle se
tapan, y el de arriba hace desaparecer al de abajo. `desfasesPara()` reparte un
`line-offset` alternando a izquierda y derecha desde el eje, más medio carril
fijo que manda ida y vuelta a lados opuestos —la geometría de la vuelta va al
revés, así que un desfase constante las separa solo—.

**El desfase se encoge al acercarse**, al revés que el grosor. A cada zoom se
hace una pregunta distinta: de lejos, «¿cuántas rutas pasan por aquí?» —y si
dos trazos se encinan, la respuesta parece «una»—; de cerca, «¿este camión baja
por mi calle?», y ahí un trazo diez píxeles al lado de la avenida es
simplemente un trazo mal dibujado. Así que la separación entre rutas va
completa a zoom de ciudad y se desvanece a un 10 % a nivel de calle. El medio
carril que separa ida de vuelta sí es constante: dos píxeles caben en cualquier
calle. La primera versión lo hacía al revés —el desfase crecía con el zoom,
como el grosor— y a zoom 18 las rutas salían despegadas del bulevar.

Dos límites más que conviene conocer:

- `line-offset` deforma el trazo en las vueltas cerradas: la línea desplazada
  se cruza consigo misma y se ve un manchón. El tamaño es proporcional al
  desfase, y por eso el paso son 6 px y no 15.
- **Las expresiones de zoom van arriba del todo.** MapLibre solo acepta
  `["zoom"]` como entrada de un `interpolate` o `step` de primer nivel. Anidar
  uno dentro de un `["*", …]` invalida la expresión, el estilo no carga y la
  pantalla acaba enseñando «no pudimos cargar el mapa» con el mapa sano
  detrás. Por eso existe `porZoom()` en `map-layers.ts`: escala el valor
  *dentro* de cada parada de la interpolación.

### El lienzo escucha a su contenedor, no a la ventana

MapLibre solo atiende el `resize` de la ventana, y eso no cubre el caso que
importa: en la ficha de ruta el mapa se amplía a pantalla completa sin que la
ventana cambie de tamaño. `<CombiajeMap>` observa su propio contenedor con un
`ResizeObserver`, llama a `resize()` y **vuelve a encuadrar**: con el doble de
alto disponible, ampliar el mapa sin re-encuadrar solo agrega espacio vacío
debajo de la ruta.

### Un error de mapa deja de ser fatal en cuanto el mapa cargó

`onError` tira la pantalla **solo** si el mapa nunca llegó a cargar. Después,
un error es casi siempre una tesela que no respondió: cambiar a la pantalla de
fallo por eso deja a alguien sin mapa teniendo uno usable enfrente. Y el
cambio de estado va en un microtask, porque MapLibre avisa mientras React
pinta las capas.

---

## 4. Decisiones del andamiaje

Cada una con el problema que resuelve. Si alguna se revierte, que sea sabiendo
qué se rompe.

### Fuente local, no Google Fonts

Inter variable, subconjunto latino, auto-hospedada con `next/font/local`:
**48 KB**. Servida desde el mismo dominio, sin resolución DNS extra ni petición
a `fonts.gstatic.com`. En 4G, con el usuario parado en una esquina, eso son
cientos de milisegundos menos antes del primer texto legible.

`display: "swap"`, a propósito: preferimos texto feo inmediato a texto
invisible.

### El documento no hace scroll

`h-dvh` + `overflow-hidden` en el contenedor de `AppShell`; el scroll vive en
`<main>`. Si el `body` se puede desplazar, el mapa a pantalla completa se rompe
en iOS en cuanto el usuario arrastra la hoja inferior. También está apagado el
`overscroll-behavior` del `html`, que es lo que provoca el rebote y el
«recargar al jalar».

### Alturas táctiles de 44 px

Los botones e inputs de shadcn miden 36 px por omisión. Esto se usa con el
pulgar, de pie, en movimiento, a veces con una sola mano. El tamaño por omisión
subió a 44 px (`size="default"`), y queda `size="sm"` en 36 px para lo
secundario.

Los inputs llevan `text-base` en móvil (16 px): con menos, Safari en iOS hace
zoom automático al enfocar el campo y descuadra el mapa.

### Paleta sobria, en `oklch`

Primario azul cobalto, guiño a la talavera poblana. Deliberadamente discreto:
**el color de las rutas lo asigna el backend y es lo único que debe gritar en
pantalla**. Si la interfaz compite, el mapa deja de leerse.

En `oklch` porque el modo oscuro en `hsl` se ve lavado: la luminosidad
perceptual no coincide con la numérica.

Hay dos tokens pensados para el mapa desde ya:
`--map-halo` (blanco en claro, casi negro en oscuro, para el halo del trazo) y
`--map-surface` (el color del lienzo mientras el estilo carga).

### Tema con `next-themes`, y el único `localStorage` del proyecto

Clase en `<html>`, `defaultTheme="system"`, clave `combiaje-tema`. Es el único
uso legítimo de `localStorage` en todo el proyecto: una preferencia local del
dispositivo, que no necesita sobrevivir ni compartirse. Cualquier otro dato va
al servidor o a la URL.

El botón cicla sistema → claro → oscuro. Detecta la hidratación con
`useSyncExternalStore`, no con `useEffect` + `setState` (ver §5).

### Navegación: una lista, dos presentaciones

`main-nav.tsx` exporta `BottomNav` (móvil, barra inferior al alcance del
pulgar) y `SideRail` (escritorio, riel vertical) desde el **mismo arreglo de
rutas**. Dos componentes con la misma lista en dos archivos se desincronizan a
la tercera semana.

Las pantallas que todavía no existen (`/planear`, `/unidades`, `/perfil`) ya
tienen página con su `EmptyState`. Cinco enlaces que dan 404 en producción se
ven peor que cinco pantallas honestas que dicen en qué hito llegan.

### Serwist (PWA) se pospone hasta después del bloque 5

Está en el stack y va a entrar. Pero un service worker cacheando un andamiaje
que cambia todos los días solo sirve versiones viejas y hace perder horas
persiguiendo bugs que ya estaban arreglados. En el bloque 1 quedan solo el
`manifest.webmanifest` y los iconos.

### TypeScript 5.9, no 7.0

TypeScript 7 (el port nativo en Go) ya salió. El proyecto se queda en la línea
5.9 hasta que ESLint y Next lo soporten sin sorpresas. Revisar en el hito M2.

### `.npmrc` eliminado

Tenía `auto-install-peers=true` y `strict-peer-dependencies=false`: ambos ya
son el comportamiento por omisión de pnpm 10. Un archivo de configuración que
no configura nada es una mentira que alguien va a creer.

---

## 5. Tropiezos de Next 16 que ya resolvimos

Déjalos documentados o los vuelve a pisar el siguiente.

1. **`NextConfig` ya no acepta la clave `eslint`.** `next lint` desapareció en
   Next 16. El lint corre como script propio (`pnpm lint`) y lo engancha CI.
2. **`eslint-config-next@16` exporta configuración plana nativa.** Nada de
   `FlatCompat` ni `@eslint/eslintrc`; se importa directo
   `eslint-config-next/core-web-vitals` y `.../typescript`.
3. **Las reglas del React Compiler rechazan `setState` dentro de `useEffect`.**
   El patrón «¿ya hidraté?» se resuelve con `useSyncExternalStore` y dos
   snapshots distintos (servidor `false`, cliente `true`), no con
   `useEffect(() => setMontado(true), [])`.
4. **No declarar `Cache-Control` propio para `/_next/static/*`.** Next ya los
   sirve con hash en el nombre e `immutable`, y sobrescribirlo rompe la recarga
   en caliente en desarrollo.
5. **Un `loading.tsx` en la raíz hace que `notFound()` responda 200.** Ese
   archivo envuelve toda la aplicación en un `Suspense`, así que Next manda el
   HTML —y con él el código de estado— antes de saber si la página existe.
   Resultado: `/rutas/una-que-no-existe` devolvía **200 OK** con el contenido
   de «no encontrada», que para Google significa «esta página es válida,
   indéxala». El límite de `Suspense` va donde de verdad hace falta (§3 ter),
   no en la raíz.
6. **Turbopack no compila en hosting compartido.** `next build` (Turbopack)
   truena al procesar `maplibre-gl.css` con PostCSS: necesita lanzar un proceso
   de Node aparte y en Hostinger ese proceso no arranca. El build de producción
   usa `--webpack`, en el servidor **y en local**, para que sea el mismo en los
   dos lados. `pnpm dev` sigue con Turbopack. Ver `docs/despliegue.md`.

---

## 6. Versiones instaladas

| Paquete           | Versión | Nota                                           |
| ----------------- | ------- | ---------------------------------------------- |
| Next.js           | 16.3.8  | Turbopack por omisión                          |
| React / React DOM | 19.3.0  |                                                |
| Tailwind CSS      | 4.3.3   | Configuración en CSS, sin `tailwind.config.js` |
| TypeScript        | 5.9.3   | Ver §4                                         |
| pnpm              | 10.18.0 | Fijado en `packageManager`                     |
| Turborepo         | 2.11.6  |                                                |
| Zod               | 4.6.5   |                                                |

---

## 7. Decisiones abiertas

- **`maplibre-gl` va en 6.11.2**; el plan maestro dice 5.x. Hay que decidir si
  se sube la versión del plan o se fija la 5. Bloquea el bloque 3.
- **⚠️ Requiere aprobación de Arquitectura.** Para registrar la fuente
  vector-tile hacen falta los nombres de las propiedades dentro de la tesela
  (`color`, `slug`, `short_name`) y los límites de zoom. Lo limpio sería un
  `GET /tiles/routes.json` (TileJSON) con `minzoom`, `maxzoom` y `bounds`.
  Mientras tanto se simula con MSW.
