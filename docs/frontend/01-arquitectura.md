# Arquitectura del frontend

## 1. Dónde encaja `apps/web`

Combiaje es un monorepo pnpm + Turborepo con cuatro dueños y una frontera clara
entre ellos: **el contrato de API**. Nadie improvisa campos.

```
combiaje/
├─ apps/
│  ├─ web/            Next.js 16 · MapLibre          ← este documento
│  └─ api/            NestJS 11 · Drizzle · PostGIS  (chat de Backend)
├─ packages/
│  ├─ shared/         tipos + esquemas Zod           (chat de Arquitectura)
│  └─ config/         tsconfig y eslint compartidos
└─ docs/
   ├─ adr/            decisiones de arquitectura     (chat de Arquitectura)
   └─ frontend/       esto                           (chat de Frontend)
```

`packages/shared` **se consume, no se declara**. Si el frontend necesita un tipo
o un campo que no existe ahí, se marca en la respuesta como
«⚠️ Requiere aprobación de Arquitectura», se propone en ese chat, y mientras
tanto se simula con MSW. Redeclarar un tipo de la API en `apps/web` es la forma
más rápida de que el día que el backend cambie algo nadie se entere.

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

Las rutas **no** se cargan como GeoJSON. Se registra
`/api/v1/tiles/routes/{z}/{x}/{y}.mvt` como fuente `vector` de MapLibre y las
capas `routes` y `stops` se estilizan del lado del cliente.

Con 100 rutas, el GeoJSON completo son decenas de megabytes: la aplicación
muere en un teléfono real. Las teselas son ~30 KB cada una y solo llegan las
del área visible.

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

---

## 6. Versiones instaladas

| Paquete | Versión | Nota |
|---|---|---|
| Next.js | 16.3.8 | Turbopack por omisión |
| React / React DOM | 19.3.0 | |
| Tailwind CSS | 4.3.3 | Configuración en CSS, sin `tailwind.config.js` |
| TypeScript | 5.9.3 | Ver §4 |
| pnpm | 10.18.0 | Fijado en `packageManager` |
| Turborepo | 2.11.6 | |
| Zod | 4.6.5 | |

---

## 7. Decisiones abiertas

- **`maplibre-gl` va en 6.11.2**; el plan maestro dice 5.x. Hay que decidir si
  se sube la versión del plan o se fija la 5. Bloquea el bloque 3.
- **⚠️ Requiere aprobación de Arquitectura.** Para registrar la fuente
  vector-tile hacen falta los nombres de las propiedades dentro de la tesela
  (`color`, `slug`, `short_name`) y los límites de zoom. Lo limpio sería un
  `GET /tiles/routes.json` (TileJSON) con `minzoom`, `maxzoom` y `bounds`.
  Mientras tanto se simula con MSW.
