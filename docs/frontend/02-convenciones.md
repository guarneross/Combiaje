# Convenciones y recetas

Cómo se escribe código en `apps/web`. La idea no es el estilo por el estilo:
cada regla de aquí evita un problema concreto que ya nos pasó o que nos va a
pasar.

---

## 1. Servidor por omisión

Todo componente es de servidor salvo prueba en contra. `"use client"` se pone
**solo** cuando el componente necesita una de estas cuatro cosas:

- El mapa (MapLibre es WebGL puro: no existe en el servidor).
- Estado de formulario o interacción (`useState`, `onChange`).
- APIs del navegador: geolocalización, `localStorage`, `matchMedia`.
- Hooks de navegación de cliente: `usePathname`, `useSearchParams`, `useRouter`.

Y se pone **lo más abajo posible en el árbol**. Si una página de servidor
necesita un botón interactivo, el `"use client"` va en el botón, no en la
página. Marcar la página entera arrastra todo su subárbol al navegador.

Señal de alarma: si `layout.tsx` o una `page.tsx` empieza con `"use client"`,
casi seguro algo se puede extraer.

---

## 2. El estado que define lo que se ve va en la URL

Si el usuario puede mandarle un enlace a alguien y esperar que vea lo mismo,
ese estado va en la URL.

**En la URL** (con `nuqs` o `useSearchParams`):

| Qué | Parámetro |
|---|---|
| Ruta seleccionada | `?ruta=ruta-72-centro-la-margarita` |
| Texto de búsqueda | `?q=centro` |
| Filtro de concesionaria | `?concesionaria=…` |
| Origen y destino del planificador | `?origen=…&destino=…` |
| Encuadre del mapa, si se comparte | `?z=14&lat=…&lng=…` |

**No en la URL**: si la hoja inferior está expandida, qué pestaña de la ficha
está abierta, el tema. Son estado de presentación; ensucian el enlace sin
aportar nada a quien lo recibe.

**Nunca en `localStorage`**: ningún dato que deba sobrevivir o compartirse. La
única excepción de todo el proyecto es la preferencia de tema.

---

## 3. Los tres estados, siempre

Cada componente que carga datos trae los tres. No es opcional y no se deja
«para después»: después es cuando alguien abre la aplicación en la calle y ve
una pantalla en blanco.

```tsx
if (isPending) return <RouteListSkeleton />;              // esqueleto, no spinner
if (error)    return <ErrorState onReintentar={refetch} />;
if (!datos.length)
  return <EmptyState
    icon={MapPinOff}
    titulo="No hay rutas a menos de 500 m"
    descripcion="Prueba ampliando el radio o busca por nombre."
    accion={<Button onClick={ampliarRadio}>Buscar a 1 km</Button>} />;
```

- **Cargando**: esqueleto con la forma de lo que viene, nunca un spinner en
  blanco. El esqueleto le dice al usuario qué está esperando.
- **Vacío**: siempre con una acción sugerida. Un callejón sin salida hace que
  la gente cierre la pestaña.
- **Error**: siempre con botón de reintento. El mensaje técnico va en `detalle`
  y solo se muestra en desarrollo; al usuario en la calle no le sirve un stack
  trace, le sirve un botón.

---

## 4. Accesibilidad AA — la lista que se revisa antes de dar por hecho algo

- [ ] Navegable con teclado de principio a fin, en orden lógico.
- [ ] Foco visible siempre (ya está global en `globals.css`; no lo quites con
      `outline: none` sin poner algo equivalente).
- [ ] Contraste ≥ 4.5:1 en texto, ≥ 3:1 en elementos de interfaz.
- [ ] Resultados de búsqueda dentro de una región con `aria-live="polite"`.
- [ ] Iconos decorativos con `aria-hidden="true"`; los que son el único
      contenido de un botón, con `aria-label`.
- [ ] **Toda información que solo se ve en el mapa tiene alternativa en lista.**
      Esto no es un extra: un mapa es inaccesible para quien usa lector de
      pantalla, y además es lo que hace la aplicación usable con el sol pegando
      en el celular.
- [ ] Área táctil mínima de 44 × 44 px.
- [ ] El zoom del navegador no está bloqueado (`maximumScale: 5`, no `1`).

---

## 5. Español de México

La interfaz está en español de México y usa las palabras de la calle, no las
del manual.

| Se dice | No se dice |
|---|---|
| camión | autobús, bus |
| ruta | línea *(salvo RUTA / BRT, que sí tiene líneas)* |
| unidad *(el vehículo concreto, por número económico)* | vehículo |
| parada | estación *(salvo en RUTA)* |
| concesionaria | agencia, operador |
| trazo | recorrido, polilínea |
| calificar | ratear, puntuar |

Los nombres de variables y funciones **del dominio** van en español
(`rutasCercanas`, `formatDistance` es la excepción porque es utilitaria). Los
de la plataforma se quedan como los nombra React o Next (`children`, `params`,
`searchParams`). Mezclar no es elegante, pero inventar traducciones de
`searchParams` es peor.

---

## 6. Nombres y organización

- Archivos: `kebab-case.tsx`. Componentes: `PascalCase`.
- Un componente exportado por archivo, salvo que sean variantes muy ligadas
  (`BottomNav` y `SideRail` comparten archivo porque comparten la lista de
  rutas; separarlos la duplicaría).
- Imports con el alias `@/`, nunca con `../../..`.
- Orden de imports: React y Next → librerías externas → `@combiaje/*` →
  `@/…` → relativos. Prettier no lo ordena solo; es disciplina.
- Los comentarios explican **por qué**, no qué. `// suma 1 a i` sobra;
  `// 44 px porque esto se toca con el pulgar en movimiento` no.

---

## 7. Recetas

### Agregar una pantalla

1. `src/app/<ruta>/page.tsx`, componente de servidor, con su `export const
   metadata = { title: "…" }`.
2. Si carga datos, agrega `loading.tsx` en el mismo segmento con el esqueleto
   que corresponda.
3. Si no es la pantalla del mapa, envuélvela con `<TopBar titulo="…" />` y un
   contenedor `min-h-0 flex-1 overflow-y-auto`.
4. Si debe aparecer en la navegación, agrégala a `NAV_ITEMS` en
   `components/layout/main-nav.tsx`. Una sola vez: se refleja en móvil y en
   escritorio.

### Agregar un componente de shadcn/ui

```bash
cd apps/web
pnpm dlx shadcn@latest add <componente>
```

Después, revisa dos cosas antes de darlo por bueno: que las alturas táctiles
sigan el criterio de 44 px, y que los textos visibles estén en español. Si lo
modificas, deja un comentario en el archivo diciendo qué cambiaste respecto a
la plantilla.

### Agregar una variable de entorno

1. Decláralo en `apps/web/.env.example` con un comentario de para qué sirve.
2. Agrégalo al esquema de `src/lib/env.ts` **y** al objeto que se le pasa a
   `safeParse`, con el nombre completo y literal: Next solo sustituye
   `process.env.NEXT_PUBLIC_*` si lo ve escrito entero, nunca a través de un
   bucle o una variable.
3. Si es pública, va con prefijo `NEXT_PUBLIC_` y **viaja al navegador**:
   jamás un secreto ahí.

### Consumir un endpoint

El endpoint debe existir en el contrato de API v1. Si no existe, se marca
«⚠️ Requiere aprobación de Arquitectura» (ver `04-contrato.md`) y se simula con
MSW mientras tanto.

Son cuatro pasos y ninguno se salta:

1. **El esquema Zod va en `packages/shared`.** Nunca un tipo de la API
   declarado dentro de `apps/web`.
2. **La función de transporte va en `lib/api/endpoints.ts`.** Una por endpoint,
   sin caché ni estado: solo arma la URL y pasa el esquema.
3. **La política de caché va en `lib/api/queries.ts`**, como `queryOptions`,
   con su clave en el objeto `claves` y un `staleTime` elegido por una razón
   («¿cada cuánto cambia esto de verdad?»), no copiado del de arriba.
4. **El handler de MSW va en `src/mocks/handlers.ts`**, y debe respetar los
   escenarios: `vacio` devuelve lista vacía, `error` devuelve un problem+json.

En el componente:

```tsx
const { data, isPending, error, refetch } = useQuery(rutasQuery({ q }));
```

Nunca `fetch` suelto en un componente. Si el dato se necesita en un componente
de servidor, se llama a la función de `endpoints.ts` directamente.

### Agregar un escenario de prueba a los mocks

En `src/mocks/scenarios.ts` está la lista. La regla: todo estado que la
interfaz tenga que manejar debe poder provocarse desde la URL, para poder
verlo con los ojos y no solo imaginarlo.

---

## 8. Lo que no se hace

- No cargar todas las rutas como GeoJSON. Nunca. Ver `01-arquitectura.md` §3.
- No pedir datos a la red para cambiar qué ruta está resaltada: eso es
  `setFilter` o `setPaintProperty`.
- No usar `localStorage` para nada que no sea la preferencia de tema.
- No inventar endpoints ni campos que no estén en el contrato.
- No redeclarar en `apps/web` tipos que son de `packages/shared`.
- No dejar una pantalla sin sus tres estados.
- No subir un cambio que empeore el presupuesto de carga sin decirlo. Ver
  `03-rendimiento.md`.
