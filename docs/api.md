# La API y dónde viven los datos

Desde el bloque 7 la API existe de verdad: Route Handlers de Next en
`apps/web/src/app/api/v1/`. Hasta entonces, el sitio en producción corría con
MSW, es decir, con datos simulados.

## La regla que explica todo lo demás

> **Las rutas viven en archivos. En Postgres solo vive lo que escribe la
> comunidad.**

```
data/rutas/<slug>/        ←  lo que tú trazas o grabas, versionado en git
      ↓ pnpm rutas
src/datos/rutas-reales.json   ←  generado, también en git
      ↓
src/datos/consultas.ts    ←  las consultas, sin HTTP
      ↓                  ↘
app/api/v1/*              mocks/handlers.ts
(producción)              (desarrollo y pruebas)
```

Postgres (Supabase) guarda **únicamente** la tabla `ratings`.

### Por qué

La capa gratuita de Supabase **pausa el proyecto por inactividad**. Si el mapa
dependiera de esa base, el sitio se caería solo cada tanto sin que nadie lo
tocara. Así, si la base no responde, el mapa, el catálogo y las fichas siguen
en pie y lo único que se degrada son las calificaciones — que ya saben decir
«todavía nadie la ha calificado».

También mantiene limpia la frontera de licencias: la geometría viene de
OpenStreetMap y es ODbL; las calificaciones son del proyecto. Están en sistemas
distintos porque son cosas distintas.

Cuando llegue el editor de trazos (hito S3) las rutas se mudarán a Postgres y
`ratings.route_slug` pasará a ser una llave foránea. Hoy es texto, y el Route
Handler comprueba que la ruta exista antes de escribir.

### Una sola implementación, dos transportes

`src/datos/consultas.ts` tiene las consultas sin HTTP. La usan los Route
Handlers **y** los handlers de MSW. Escribirla dos veces es cómo se consigue
que la aplicación se comporte distinto en desarrollo y en producción, y que una
prueba en verde no signifique nada.

Lo único que MSW agrega son los escenarios de falla
(`?simular=vacio|error|lento`), que el servidor real no debe tener.

## Los endpoints

| Método | Ruta | Auth | De dónde sale |
|---|---|---|---|
| `GET` | `/api/v1/routes` | — | archivos |
| `GET` | `/api/v1/routes/:slug` | — | archivos **+** promedios de Postgres |
| `GET` | `/api/v1/routes/:slug/geojson` | — | archivos |
| `GET` | `/api/v1/agencies` | — | archivos |
| `GET` | `/api/v1/stops` | — | archivos |
| `GET` | `/api/v1/nearby` | — | archivos |
| `POST` | `/api/v1/trip-plan` | — | archivos |
| `GET` | `/api/v1/routes/:slug/ratings` | — | Postgres |
| `POST` | `/api/v1/routes/:slug/ratings` | 🔒 | Postgres |
| `DELETE` | `/api/v1/ratings/:id` | 🔒 | Postgres |

Las URLs son exactamente las del contrato de API v1 del plan maestro. El
cliente HTTP del navegador no se enteró de que el backend apareció.

Lo que se cachea y lo que no: el catálogo y la geometría llevan
`stale-while-revalidate` porque cambian cada varias semanas. **`/nearby` no se
cachea nunca**: lleva la ubicación de alguien dentro.

## Seguridad: no hay llave de servicio

El servidor usa la **misma llave pública** que usaría el navegador. Cuando la
petición trae sesión, le pasa el token tal cual a Postgres, y quien decide qué
fila puede tocar cada quien es la seguridad a nivel de fila.

Una llave de servicio se salta todas las políticas: basta con que se cuele en
un log, en un commit o en una variable mal puesta para que cualquiera pueda
borrar o falsificar calificaciones. **Si no existe, no se puede filtrar.**

El costo es que todas las reglas tienen que estar escritas en la migración. Y
ahí están, probadas contra un Postgres de verdad:

| Intento | Resultado |
|---|---|
| A escribe su calificación | ✅ |
| A corrige su calificación | ✅ |
| A califica **en nombre de B** | ❌ `violates row-level security policy` |
| B modifica la calificación de A | ❌ 0 filas |
| B borra la calificación de A | ❌ 0 filas |
| Alguien sin sesión escribe | ❌ `permission denied` |
| Alguien sin sesión lee comentarios y promedios | ✅ |

Tampoco hay conexión directa a Postgres. En hosting compartido, Passenger
levanta y mata procesos a su antojo, y cada proceso con su propio pool es la
forma clásica de agotar el límite de conexiones de la capa gratuita. Todo va
por HTTP.

## Cómo se califica

Una persona, una opinión por ruta, siempre corregible. Volver a calificar
**actualiza** la anterior.

Esto se aparta del plan maestro, que tenía un índice único por semana y por lo
tanto permitía varias filas de la misma persona para la misma ruta. Con ese
diseño, quien usa una ruta a diario podía acumular cincuenta votos y mover el
promedio él solo, y «mi calificación» dejaba de tener una respuesta única.

Lo único obligatorio son las estrellas. Unidad, comentario y las cinco
dimensiones son opcionales — ver `02-modelo-de-rutas-y-calificaciones.md` §4.

**No hay tabla `vehicles`.** El número de unidad es texto libre dentro de la
calificación. El plan la tenía colgando de `routes`, lo cual es falso: una
unidad anda hoy en un recorrido y mañana en otro. Mientras el selector sea
opcional y no exista la pantalla `/unidades`, una tabla aparte no compra nada,
y así es imposible volver a atar una unidad a una ruta por accidente.

**Nadie firma su opinión.** La API no devuelve el identificador de quien
calificó. Con sesiones anónimas no habría nada que enseñar, y publicarlo
permitiría cruzar quién calificó qué ruta — es decir, por dónde se mueve una
persona.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

Región la más cercana a Puebla. Apunta la contraseña de la base en tu gestor de
contraseñas: **no la vas a necesitar aquí**, pero recuperarla después es un
trámite.

### 2. Correr la migración

Editor SQL del panel → pegar `db/migraciones/0001_calificaciones.sql` → correr.
Es idempotente: se puede volver a correr sin romper nada.

### 3. Encender las sesiones anónimas

Authentication → Providers → **Anonymous sign-ins**.

Es lo que permite calificar de un toque, sin registro, parado en la esquina.
Supabase crea un usuario de verdad, con su propio id, aunque nunca dé un
correo; después puede vincular su Google y conservar sus calificaciones.

Dos cosas que conviene saber:

- **Enciende también el CAPTCHA invisible** (Turnstile) en Authentication →
  Settings. Cada sesión anónima es una fila en `auth.users`, y sin eso alguien
  puede inflarte la base por gusto. Supabase ya limita a 30 por hora por IP.
- **No se limpian solos.** Cada tanto, borrar los anónimos viejos que nunca
  calificaron; la consulta está escrita al final de la migración.

### 4. Las dos variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

En `apps/web/.env.local` para desarrollo, y en el panel de Hostinger para
producción. Las dos son públicas; viajan al navegador de todos modos.

### 5. Apagar los mocks en producción

```
NEXT_PUBLIC_ENABLE_MOCKS=false
```

**Esto es obligatorio.** Si se queda en `true`, MSW se pone delante de la API y
el sitio sirve datos simulados aunque haya base de datos detrás. En desarrollo
se queda en `true`: las rutas salen igual y los escenarios de falla siguen
disponibles.

### 6. Comprobar

```bash
curl -s https://combiaje.joscian.com/api/v1/routes | head -c 200
curl -s https://combiaje.joscian.com/api/v1/routes/ruta-21-canal-centro \
  | python -c "import json,sys; print(json.load(sys.stdin)['ratingStats'])"
```

Lo segundo debe imprimir `None` mientras nadie haya calificado, y **no** un
error. Si truena, la base está mal configurada; si imprime `None`, todo está en
su sitio y lo que falta es la pantalla para calificar.
