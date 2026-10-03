# Documentación del frontend

Esta carpeta es la referencia técnica de `apps/web`. Se actualiza en cada
bloque de trabajo, no al final.

Para quién: cualquiera del equipo que vaya a tocar la aplicación web, incluido
tú mismo dentro de tres semanas, después de los parciales, cuando ya no te
acuerdes de por qué el botón mide 44 px.

| Documento | Qué resuelve |
|---|---|
| [`01-arquitectura.md`](./01-arquitectura.md) | Cómo está armado, qué vive dónde y **por qué** se decidió así |
| [`02-convenciones.md`](./02-convenciones.md) | Cómo escribir código aquí, y recetas para las tareas repetidas |
| [`03-rendimiento.md`](./03-rendimiento.md) | El presupuesto de carga, cómo se mide y qué se ha medido |
| [`04-contrato.md`](./04-contrato.md) | La propuesta de `packages/shared` y las seis decisiones pendientes de Arquitectura |

La bitácora cronológica (qué se hizo y cuándo) vive en el proyecto de Claude,
en `combiaje/13-frontend-bitacora.md`, para que los chats de backend, datos y
QA la vean sin clonar el repo.

---

## Estado

Hito 1 — «La primera ruta vive en producción».

| # | Bloque | Estado |
|---|---|---|
| 1 | Andamiaje | ✅ hecho |
| 2 | Capa de datos (cliente HTTP, TanStack Query, MSW) | ✅ hecho |
| 3 | `<CombiajeMap>` | ⬜ pendiente |
| 4 | Pantalla `/` con buscador y «rutas cerca de mí» | ⬜ pendiente |
| 5 | `/rutas` y `/rutas/[slug]` | ⬜ pendiente |
| 6 | Pruebas con Vitest | ⬜ pendiente |

---

## Arranque

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # en Windows: copy ... .env.local
pnpm dev                                        # http://localhost:3000
```

No hace falta el backend: la aplicación arranca contra MSW con diez rutas
simuladas de Puebla (`NEXT_PUBLIC_ENABLE_MOCKS=true`).

Para ver los estados vacío, de error y de red lenta sin tocar código, agrega un
parámetro a cualquier URL:

```
http://localhost:3000/rutas?simular=vacio
http://localhost:3000/rutas?simular=error
http://localhost:3000/rutas?simular=lento
```

### pnpm en Windows

`corepack enable` escribe en `C:\Program Files\nodejs` y falla con `EPERM` si
la terminal no es de administrador. Dos salidas:

```powershell
# A) sin permisos de administrador
npm install -g pnpm@10.18.0

# B) con la terminal abierta como administrador (una sola vez, es lo preferible
#    porque fija la misma versión para todo el equipo)
corepack enable
```

En ambos casos el campo `"packageManager": "pnpm@10.18.0"` del `package.json`
raíz sigue mandando: pnpm 10 lo lee y se ajusta solo.

---

## Comandos

Todos se corren desde la raíz del repo; Turborepo los reparte.

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint. **No corre dentro de `next build`**: en Next 16 desapareció `next lint` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (desde el bloque 6) |
| `pnpm format` | Prettier sobre todo el repo |

---

## Las cinco reglas que no se negocian

1. **El mapa es el producto.** Todo lo demás flota encima sin taparlo.
2. **Componentes de servidor por omisión.** `"use client"` solo donde de verdad
   hace falta.
3. **Tres estados siempre**: cargando, vacío y error. Ninguna pantalla muda.
4. **Lo que el usuario está viendo va en la URL**, para que el enlace se pueda
   compartir.
5. **No se inventan endpoints.** Lo que no está en el contrato de API se marca
   como «⚠️ Requiere aprobación de Arquitectura» y se simula con MSW.
