# Despliegue

**Hostinger** (plan con Node.js), no Vercel. Dos razones:

1. **Ya está pagado** por cuatro años, con ancho de banda ilimitado y 50 GB de
   disco.
2. **El plan Hobby de Vercel prohíbe el uso comercial.** En cuanto Combiaje
   tenga un patrocinador —la vía de ingreso número uno del modelo de negocio—
   estaríamos fuera de términos. Hostinger no tiene esa restricción.

| Pieza                          | Dónde vive                      | Por qué                                                                  |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| Aplicación Next.js (web + API) | **Hostinger**, Node 24          | Soporta Next.js y pnpm; sin límite de uso comercial                      |
| PostgreSQL + PostGIS           | **Supabase**, capa gratuita     | Hostinger compartido solo da MySQL, y PostGIS es obligatorio             |
| Autenticación                  | **Supabase Auth**               | Viene con la base                                                        |
| `rutas.pmtiles` y mapa base    | **Hostinger**, archivo estático | Ancho de banda ilimitado; mejor que la capa gratuita de Supabase Storage |
| Correo de contacto             | **Hostinger**                   | El plan maestro §13 lo exige y Vercel no hace correo                     |

## Datos del servidor

- Node 24.x · npm, yarn o **pnpm**
- 50 GB de disco · 3 GB de RAM · 2 núcleos · 120 procesos
- Ubicación: **Boston, EE. UU.** → ~60–80 ms desde Puebla. Aceptable, pero ver
  «Cloudflare» abajo.
- 50 sitios permitidos en el plan.

## Dominio

Mientras no haya dominio propio, el sitio vive en un **subdominio de
`joscian.com`**:

```
combiaje.joscian.com
```

Se crea en hPanel → Dominios → Subdominios, y queda listo en minutos. Un
dominio propio (`.mx` o `.com.mx`, 200–400 pesos al año) conviene **antes de
enseñárselo a usuarios reales o a prensa**, no antes de desplegar. La regla del
proyecto es desplegar el primer día; el nombre bonito puede esperar.

## Cómo se construye

El build usa `output: "standalone"`: produce un servidor autocontenido en
`.next/standalone` con solo las dependencias que de verdad se usan. Pesa unos
60 MB y **no necesita `pnpm install` en el servidor**.

```bash
pnpm install
pnpm --filter @combiaje/web build
```

### ⚠️ El build de producción usa webpack, no Turbopack

`apps/web` compila con `next build --webpack`. No es nostalgia: **Turbopack
revienta en el servidor de Hostinger**. Al procesar `maplibre-gl.css` con
PostCSS necesita lanzar un proceso de Node aparte, y en hosting compartido ese
proceso no arranca:

```
FATAL: An unexpected Turbopack error occurred.
- Execution of evaluate_webpack_loader failed
- creating new process
- node process exited before we could connect to it with exit status: 0
```

El límite de procesos del plan (120) y la memoria compartida son la causa
probable. Con webpack el mismo build pasa sin tocar nada más.

Se usa webpack **también en local**, a propósito: un build de producción que se
arma distinto en tu máquina y en el servidor es una fuente de errores que solo
aparecen en producción. `pnpm dev` sigue con Turbopack, que es donde la
velocidad importa.

### ⚠️ El detalle que rompe todos los despliegues standalone

Next **no copia** `public/` ni `.next/static/` dentro de `.next/standalone`.
Si se sube tal cual, el sitio carga sin estilos, sin fuentes y sin iconos.
Hay que copiarlos:

Ya no hay que acordarse: `scripts/preparar-standalone.mjs` lo hace al final de
cada build, en Windows y en el servidor por igual (nada de `cp -r`). Está
enganchado al script `build` de `apps/web`.

Lo que se sube es el contenido de `.next/standalone/`, y se arranca con:

```bash
node apps/web/server.js      # respeta PORT y HOSTNAME
```

## La configuración exacta en hPanel

Se crea con **Sitios web → Crear sitio web → Aplicación web**, eligiendo el
subdominio `combiaje.joscian.com` (nunca `joscian.com`: ahí vive el POS).

| Campo            | Valor                                                         |
| ---------------- | ------------------------------------------------------------- |
| Framework preset | `Other`                                                       |
| Node version     | `22.x`                                                        |
| Root directory   | `./` — la raíz del monorepo, donde está `pnpm-workspace.yaml` |
| Package manager  | `pnpm`                                                        |
| Build command    | `pnpm run build`                                              |
| Output directory | `apps/web/.next`                                              |
| Entry file       | `apps/web/.next/standalone/apps/web/server.js`                |

El _entry file_ conserva `apps/web` dentro del paquete autocontenido porque
`outputFileTracingRoot` apunta a la raíz del monorepo.

## Variables de entorno en producción

En hPanel, en la configuración de la aplicación Node:

```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://combiaje.joscian.com
NEXT_PUBLIC_API_URL=https://combiaje.joscian.com
NEXT_PUBLIC_ENABLE_MOCKS=true      # hasta que exista la base real
DATABASE_URL=...                   # Supabase, pooler en modo transacción
```

> `NEXT_PUBLIC_ENABLE_MOCKS=true` en producción es intencional por ahora: el
> sitio público corre con datos simulados hasta que haya dataset. El banner de
> la interfaz debe decirlo con todas sus letras para no engañar a nadie.

## Monorepo: lo que hay que probar en el primer despliegue

El despliegue de Hostinger por GitHub suele asumir una aplicación en la raíz
del repositorio. Este es un monorepo pnpm con la app en `apps/web`. **Hay que
confirmar en el primer intento** si acepta configurar el directorio de trabajo
y el comando de build. Si no:

- **Plan B:** construir en local y subir `.next/standalone` por FTP o Git. Es
  menos elegante y funciona perfectamente.
- **Plan C:** una GitHub Action que construya y suba por FTP en cada push a
  `main`. Es lo que acabará siendo.

## Cloudflare por delante (opcional, gratis, recomendado)

El servidor está en Boston y el hosting compartido no trae CDN. Poner
Cloudflare gratis delante del dominio da cacheo en el borde cerca de Puebla
para lo que más pesa: los `.pmtiles`, las fuentes y los archivos estáticos.

No es necesario para el primer despliegue. Sí lo es antes de que haya usuarios
de verdad.

## Lista del primer despliegue

- [ ] Crear el subdominio `combiaje.joscian.com` en hPanel.
- [ ] Crear la aplicación Node (Node 24) apuntando a ese subdominio.
- [ ] Conectar el repositorio de GitHub, o preparar el envío por FTP.
- [ ] Cargar las variables de entorno.
- [ ] Desplegar y abrirlo **en el celular**, no solo en la computadora.
- [ ] Anotar en la bitácora la fecha del primer despliegue. Desde aquí, nada
      se queda esperando a estar completo.
