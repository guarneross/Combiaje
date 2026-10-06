"use client";

import dynamic from "next/dynamic";

import { MapSkeleton } from "@/components/feedback/skeletons";

/**
 * MapLibre pesa unos 250 KB comprimidos y es WebGL puro: no existe en el
 * servidor. Se carga aparte del paquete inicial para no gastar el presupuesto
 * de los 3 segundos en 4G antes de que se vea nada.
 */
export const CombiajeMap = dynamic(
  () => import("./combiaje-map").then((m) => m.CombiajeMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export type { CombiajeMapProps } from "./combiaje-map";
