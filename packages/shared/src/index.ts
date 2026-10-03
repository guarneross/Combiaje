/**
 * @combiaje/shared — tipos, esquemas Zod y constantes del contrato de API v1.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  ⚠️  BORRADOR PENDIENTE DE APROBACIÓN DE ARQUITECTURA                 │
 * │                                                                       │
 * │  Estos esquemas los redactó el chat de FRONTEND derivándolos del      │
 * │  contrato de API v1 y del modelo de datos del plan maestro, para no   │
 * │  quedarse bloqueado esperando. Arquitectura es la dueña de este       │
 * │  paquete: al revisarlos, lo que cambie aquí manda sobre lo que haya   │
 * │  en `apps/web`.                                                       │
 * │                                                                       │
 * │  Los puntos que necesitan decisión están marcados con ⚠️ en cada      │
 * │  archivo y resumidos en `docs/frontend/04-contrato.md`.               │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Frontend los CONSUME; no los declara. Si falta un tipo, se propone aquí
 * y se simula con MSW mientras tanto.
 */

export const SHARED_CONTRACT_VERSION = "v1" as const;

export * from "./primitives";
export * from "./agency";
export * from "./route";
export * from "./stop";
export * from "./nearby";
export * from "./trip-plan";
export * from "./geojson";
export * from "./constants";
