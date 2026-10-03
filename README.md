# Combiaje

Mapa del transporte público de Puebla. Qué camión te lleva a dónde vas.

Proyecto ciudadano independiente. Datos propios bajo ODbL, con atribución a
OpenStreetMap.

## Levantar el proyecto

```bash
npm install -g pnpm@10.18.0        # o: corepack enable (ver nota de Windows)
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev                           # web en http://localhost:3000
```

No necesitas el backend corriendo: la aplicación arranca contra MSW
(`NEXT_PUBLIC_ENABLE_MOCKS=true`) con rutas simuladas de Puebla.

> **Windows**: `corepack enable` escribe en `C:\Program Files\nodejs` y falla
> con `EPERM` si la terminal no es de administrador. O abres PowerShell como
> administrador y lo corres una vez, o usas `npm install -g pnpm@10.18.0`, que
> no necesita permisos. En ambos casos el campo `"packageManager"` de este
> `package.json` fija la versión.

## Estructura

```
apps/web         Next.js 16 · App Router · MapLibre        (Frontend)
apps/api         NestJS 11 · Drizzle · PostGIS             (Backend)
packages/shared  tipos + esquemas Zod + constantes         (Arquitectura)
packages/config  tsconfig y eslint compartidos
docs/frontend    documentación de la aplicación web
docs/adr         decisiones de arquitectura
```

## Documentación

- [`docs/frontend/`](./docs/frontend/README.md) — cómo está armada la
  aplicación web, sus convenciones y su presupuesto de rendimiento.
- El contrato de API v1 y el modelo de datos viven en el plan maestro del
  proyecto.

Nadie inventa endpoints ni campos: se proponen a Arquitectura primero.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint (no corre dentro de `next build`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm format` | Prettier |
