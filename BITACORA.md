# Bitácora

Una línea por sesión: qué hice, qué sigue. Sirve para volver después de tres
semanas sin tener que releer el repositorio.

La historia larga de cada bloque está en `docs/frontend/` y en el proyecto.

---

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

- [ ] Primer despliegue en `combiaje.joscian.com`.
- [ ] Inicializar git y subir a GitHub.
- [ ] Grabar la primera ruta completa, ida y vuelta, con GPX.
- [ ] Decidir si se registra un dominio propio.
