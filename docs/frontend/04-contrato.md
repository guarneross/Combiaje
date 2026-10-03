# Propuesta de `packages/shared` — para el chat de Arquitectura

> **Estado: borrador.** Lo redactó Frontend derivándolo del contrato de API v1
> y del modelo de datos del plan maestro, para no quedarse bloqueado. El dueño
> del paquete es Arquitectura: lo que decida ahí manda sobre `apps/web`.
>
> Mientras tanto, MSW responde exactamente con estas formas, así que el
> frontend avanza sin backend y sin inventar endpoints.

---

## Qué quedó definido

| Archivo | Cubre |
|---|---|
| `primitives.ts` | uuid, slug, color hex, coordenadas, bbox, paginación, error RFC 7807 |
| `agency.ts` | `Agency` y sus cuatro tipos |
| `route.ts` | `RouteSummary`, `RouteVariant`, `RouteRatingStats`, `RouteDetail`, las cinco dimensiones de calificación |
| `stop.ts` | `Stop` y sus tres clases |
| `nearby.ts` | respuesta de `GET /nearby` |
| `trip-plan.ts` | transcripción literal del ejemplo del plan maestro |
| `geojson.ts` | respuesta de `GET /routes/:slug/geojson` |
| `constants.ts` | radios, límites de página, parámetros del promedio bayesiano |

Lo de calificaciones, unidades y contribuciones (hito M3) no se definió
todavía: no hace falta para el hito 1 y declarar esquemas que nadie usa es
superficie que envejece sola.

---

## Las seis decisiones que necesitan tu visto bueno

### 1. ⚠️ camelCase en todo el JSON de salida

El ejemplo de `POST /trip-plan` del plan maestro usa **camelCase**
(`totalWalkM`, `routeShortName`, `onboardDistanceM`). Pero las consultas SQL
de §7 devuelven columnas en **snake_case** (`distance_m`, `short_name`,
`long_name`).

Si el backend serializa lo que sale de Postgres sin transformar, la misma API
va a responder `/nearby` en snake_case y `/trip-plan` en camelCase.

**Propuesta: camelCase en todas las respuestas**, y que el backend haga el
mapeo. Es la convención de TypeScript y evita que cada consumidor invente su
propia traducción. Es la decisión más barata de tomar ahora y la más cara
después.

### 2. ⚠️ Forma de la respuesta paginada

El contrato define los parámetros de entrada (`page`, `limit`) pero no la
forma de salida. Propuesta:

```jsonc
{ "items": [...], "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
```

`total` y `totalPages` son lo mínimo para pintar un paginador sin adivinar.

### 3. ⚠️ `GET /nearby` debe incluir `slug`

El SQL de §7.1 selecciona `id, short_name, long_name, color, distance_m`. Falta
`slug`, y sin él, cada resultado de «rutas cerca de mí» necesita una segunda
petición solo para poder enlazar a la ficha. Son veinte peticiones extra en una
pantalla que se usa en la calle con datos móviles.

Propuesta: agregar `slug` al `SELECT`. Costo cero, ya está en la tabla.

### 4. ⚠️ `GET /routes` con la concesionaria embebida

Propuesta: que cada elemento traiga `agency` completa (`id`, `name`,
`shortName`, `type`) en lugar de solo `agencyId`. Son cuatro campos de una
tabla de diez filas; sin ellos, pintar el catálogo obliga a cruzar en el
cliente contra `GET /agencies`.

Si prefieres mantener solo `agencyId`, se quita y el frontend cachea el
catálogo aparte. Dímelo y lo ajusto.

### 5. ⚠️ TileJSON para la fuente vector-tile

Para registrar `/tiles/routes/{z}/{x}/{y}.mvt` en MapLibre hacen falta:

- los **nombres de las propiedades** dentro de la tesela (se asume `color`,
  `slug`, `short_name`, `route_id`);
- `minzoom` y `maxzoom`;
- `bounds` del área cubierta.

Lo limpio sería un `GET /tiles/routes.json` que devuelva un TileJSON estándar.
MapLibre lo consume directo y el día que cambien los límites de zoom no hay
que tocar el frontend. **Esto bloquea el bloque 3.**

### 6. ⚠️ `ratingStats` en `null`, no en cero

Cuando una ruta no tiene calificaciones, los promedios llegan como `null` y no
como `0`. Un promedio de cero es una afirmación falsa («esta ruta es pésima»);
la ausencia de datos no lo es. En la interfaz se traduce a «Todavía sin
calificar», que es la verdad.

---

## Cómo responder a esto

Lo más útil: revisar los seis puntos, decidir, y ajustar `packages/shared`
directamente. Frontend se adapta a lo que quede, y si algo cambia, `apps/web`
deja de compilar — que es exactamente lo que queremos que pase.
