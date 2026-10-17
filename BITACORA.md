# Bitácora

Una línea por sesión: qué hice, qué sigue. Sirve para volver después de tres
semanas sin tener que releer el repositorio.

La historia larga de cada bloque está en `docs/frontend/` y en el proyecto.

---

## 2026-10-15 · La pantalla principal deja de ser un mapa de todo

El detonante: con dos rutas trazadas (Canal y Josefina Aparicio), la pantalla
abría pintando las cuatro líneas —ida y vuelta de cada una— encima del centro.
Un nudo. Con diez rutas habría sido ilegible, y el problema no era de dibujo:
era que la pantalla contestaba una pregunta que nadie hizo.

- **Ahora pregunta.** «¿A dónde quieres ir?» arriba, mapa limpio detrás. El
  mismo cuadro busca lugares y rutas: quien escribe «Zócalo» quiere llegar,
  quien escribe «21» quiere ver esa ruta.
- **Los trazos son la respuesta**, no el fondo. `<CombiajeMap>` recibe
  `rutasVisibles` y solo descarga la geometría de lo que esa lista pide.
- **La red completa sigue existiendo**, en `/rutas`, que es donde se entra a
  propósito para ver todo. Un solo sentido; la ficha es la única pantalla con
  ida y vuelta juntas.
- **Desfase por ruta** (`line-offset`): dos trazos sobre la misma avenida ya no
  se tapan, y ida y vuelta caen cada una a su lado de la calle.
- **Arreglado el orden origen → destino** en `/trip-plan`. Antes proponía la
  ida y la vuelta de la misma ruta como dos opciones y una te llevaba al lado
  contrario. La distancia a bordo ya no es un porcentaje inventado del largo
  total, son los metros entre donde subes y donde bajas.
- Un error del mapa deja de ser fatal en cuanto el mapa cargó.
- 48 pruebas (eran 37). Las nuevas del planificador corren sobre una avenida
  inventada: la regla del orden no se puede afirmar sobre un dataset que
  cambia cada vez que subes una ruta.

### Y dos arreglos de lo mismo, al verlo en la calle

Con dos rutas reales encima del Boulevard Héroes del 5 de Mayo, a zoom de
calle los trazos salían **despegados de la avenida**. El desfase crecía con el
zoom, igual que el grosor, y a zoom 18 eran veinte píxeles.

Ahora se encoge al acercarse. De lejos la pregunta es «¿cuántas rutas pasan
por aquí?» y la separación hace falta; de cerca es «¿baja por mi calle?» y lo
que hace falta es precisión. El medio carril que separa ida de vuelta sí es
constante: dos píxeles caben en cualquier calle.

Ojo: lo que quede fuera de la calle después de esto **es el trazo**, no el
dibujo. Son líneas a mano; se arreglan grabando la ruta en GPX.

Y en el teléfono, la ficha de ruta: el mapa medía 208 px —una franja inútil
para seguir diez kilómetros— y no se podía agrandar. Ahora mide 40dvh y tiene
botón de **ampliar a pantalla completa**, con Escape para cerrar. El mapa
observa su propio contenedor y se vuelve a encuadrar al cambiar de tamaño;
MapLibre solo escucha el `resize` de la ventana, y ampliar no cambia la
ventana.

**Sigue:** tocar un punto del mapa → «qué pasa por aquí».

### Y el mismo día, el geocodificador

Ya se puede escribir una calle o una colonia, no solo las doce terminales del
dataset. `GET /geocode?q=` junta nuestras paradas con **Photon** (el buscador
de komoot sobre OpenStreetMap: gratuito, sin llave, ODbL).

- **Pasa por nuestro servidor**, no por el navegador: si no, lo que teclea
  cada persona y su IP se irían a un tercero letra por letra.
- **Antirrebote de 350 ms y tres letras mínimo.** Escribir «angelópolis» es
  una consulta, no once.
- **Si Photon no contesta, no pasa nada grave:** 200 con los lugares propios y
  `partial: true`, y la pantalla lo dice.
- Recorta al área metropolitana, ordena colonia > calle > negocio, quita
  duplicados. Lo que se busca **no se registra en ningún log**.
- `PHOTON_URL` cambia el proveedor sin tocar código.
- **`NEXT_PUBLIC_API_URL` ahora apunta a `localhost:3000`**, no a 3001. Era de
  cuando el backend iba a ser un proceso aparte; con los mocks encendidos daba
  igual, pero todo lo que MSW no simula —calificaciones y geocodificador— se
  iba a un puerto donde no hay nadie. **Cámbialo también en tu `.env.local`.**

57 pruebas. Photon no se simula en los handlers de desarrollo, igual que las
calificaciones: lo que está detrás de un servicio externo pasa de largo.

## 2026-10-08 · Bloque 6: pruebas

Hito 1 cerrado. 24 pruebas con Vitest y Testing Library, en tres archivos:
«rutas cerca de mí», el buscador y el cliente HTTP.

- Se prueban **los cuatro desenlaces** de cada pantalla —con datos, vacío,
  error de la API, y error de ubicación— y las decisiones que tomamos a
  propósito: el mínimo de dos letras, no ofrecer «reintentar» cuando negaron
  el permiso, y **encontrar una ruta por su número anterior**, que es el plus
  de la renumeración.
- Las respuestas salen de MSW, los mismos handlers de desarrollo, así que se
  prueba la aplicación hablando con el contrato de verdad: pasa por Zod y por
  `ApiError`. El cliente HTTP tiene su propia tanda, incluida la que rechaza
  un 200 cuya forma no cumple el contrato. Esa es la que va a avisar el día
  que el backend real devuelva algo distinto de lo acordado.
- **Las pruebas traen sus propios datos** (`src/pruebas/datos.ts`), no los de
  `mocks/data/puebla.ts`: ese archivo cambia con cada ruta que tracemos, y una
  prueba que afirme «hay tres resultados» empezaría a fallar sola.
- Comprobado que sirven: con `MINIMO_BUSQUEDA` en 1 y el botón de reintentar
  siempre visible, fallaron exactamente las dos pruebas que debían.

Las convenciones quedaron en `docs/frontend/02-convenciones.md` §9.

**Sigue:** trazar la vuelta de la Ruta 21, y grabar alguna a bordo con el
soporte de GPX. Y cambiar la contraseña de MySQL del POS.

## 2026-10-06 · 🚀 Primer despliegue: Combiaje está en línea

**https://combiaje.joscian.com** — la Ruta 21, trazada a mano de memoria, viva
en internet. Hostinger, Node 22, aplicación aparte del sitio principal.
`joscian.com` y el POS no sufrieron ni un segundo de interrupción.

Tres cosas que rompieron y cómo se arreglaron, en orden:

1. **Turbopack no compila en hosting compartido.** Revienta al procesar
   `maplibre-gl.css` con PostCSS: necesita lanzar un proceso de Node aparte y
   el plan no se lo permite. El build de producción usa `--webpack`, aquí y en
   el servidor, para que sea el mismo en los dos lados.
2. **Next no copia `public/` ni `.next/static/` dentro de `standalone`.** Ahora
   lo hace `scripts/preparar-standalone.mjs` al final de cada build.
3. **MSW tiraba el servidor entero.** `@mswjs/interceptors` lee un `.wasm` que
   al empaquetarse quedó con la ruta absoluta de la carpeta de compilación;
   Hostinger publica en otra carpeta, el archivo no estaba, y todo el sitio
   respondía 500. Se arregla con `serverExternalPackages` en `next.config.ts`.
   La prueba que lo detecta antes de desplegar —copiar `standalone` a otra ruta
   y arrancarlo desde ahí— quedó escrita en `docs/despliegue.md`.

Sobre el servidor, lo que encontramos: **todo `joscian.com` ya era una
aplicación Express con Passenger** (el POS es una ruta dentro de ella), así que
el aislamiento se logró con un sitio aparte, con su propio proceso y su propia
versión de Node. Nunca se tocó el `.htaccess` del dominio principal.

**Pendiente urgente, no de código**: la contraseña de MySQL del POS está
escrita en `ecosystem.config.js` y se compartió en un chat. Cambiarla en
horario de cierre, actualizar el archivo y reiniciar la aplicación.

**Sigue:** bloque 6 (pruebas con Vitest) y trazar la vuelta de la Ruta 21.

## 2026-10-06 · Bloque 5: catálogo y ficha de ruta

- `/rutas` con búsqueda y filtro por concesionaria (ambos en la URL), y
  `/rutas/[slug]` **renderizada en servidor**, con la línea de tiempo de
  denominaciones para la renumeración de la SMT y el resumen de
  calificaciones. MSW ahora también intercepta en el servidor
  (`instrumentation.ts`).
- Tres cosas que se encontraron haciéndolo y se arreglaron:
  - `app/loading.tsx` hacía que `notFound()` respondiera **200**. Fuera de la
    raíz; los `Suspense` ahora van en la pantalla que los necesita.
  - La ficha montaba **dos** mapas (uno `lg:hidden`). Ahora es uno, colocado
    con `grid`, y el catálogo no lo monta en móvil.
  - El encuadre heredaba 280 px de relleno inferior en un mapa de 208 px: la
    ruta salía diminuta. `relleno` es ahora una prop de la pantalla y el mapa
    lo recorta a lo que cabe.
- `scripts/construir-rutas.mjs` deriva número y color de la **denominación
  vigente**, y avisa si el encabezado de `ruta.json` dice otra cosa. Así,
  cuando llegue el número nuevo de la SMT, basta con anotarlo.
- Medido: la ficha llega a LCP en 860 ms (LCP = FCP: todo venía en el HTML).
  La pantalla principal no se movió.

**Sigue:** bloque 6, pruebas con Vitest. Y desplegar.

## 2026-10-03 · Capa de datos y decisiones de arquitectura

- Bloque 2 terminado: cliente HTTP tipado que valida con Zod, TanStack Query y
  MSW con 10 rutas simuladas. `/rutas` ya carga de verdad.
- El proyecto pasa de 4 personas a 1. Plan re-escalado: ver `01-plan-solo.md`
  en el proyecto.
- **Arquitectura colapsada**: fuera NestJS y Fly.io. La API vive como Route
  Handlers de Next en el mismo repo. Las URLs del contrato no cambian.
- **Teselas**: de endpoint `ST_AsMVT` en vivo a archivo `.pmtiles`
  precalculado.
- **Despliegue**: Hostinger, no Vercel (Hobby prohíbe uso comercial). Ver
  `docs/despliegue.md`.
- Licencias fijadas: código AGPL-3.0, datos ODbL-1.0.

**Sigue:** bloque 3, el componente `<CombiajeMap>`.

## 2026-10-02 · Andamiaje

- Monorepo creado: Next.js 16, Tailwind v4, shadcn/ui, tema claro/oscuro,
  fuente local, navegación móvil y de escritorio.
- Compila, pasa lint y typecheck. Medido: LCP 664 ms en 4G simulada.

---

## Pendientes que no son de código

- [x] ~~Primer despliegue en `combiaje.joscian.com`~~ — 6 de octubre de 2026.
- [x] ~~Inicializar git y subir a GitHub.~~
- [ ] **Cambiar la contraseña de MySQL del POS** (está en `ecosystem.config.js`).
- [ ] Grabar la primera ruta completa, ida y vuelta, con GPX.
- [ ] Decidir si se registra un dominio propio.
