import type { Agency, RouteDetail, RouteSummary, Stop } from "@combiaje/shared";

import rutasReales from "./rutas-reales.json";

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  DATOS SIMULADOS. NO SON EL DATASET REAL DE COMBIAJE.                │
 * │                                                                      │
 * │  Los trazos son líneas rectas entre puntos de referencia conocidos   │
 * │  del área metropolitana: sirven para desarrollar la interfaz, NO     │
 * │  describen el recorrido real de ninguna ruta. Los números económicos │
 * │  y los nombres de ruta son inventados.                               │
 * │                                                                      │
 * │  El dataset de verdad lo construye el rol de Datos/GIS (hito M1-M2)  │
 * │  y se publicará bajo ODbL. Nada de este archivo debe acabar en él.   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * El corredor elegido es el que recomienda el plan maestro para el hito 1:
 * CAPU ↔ Centro ↔ Angelópolis, más Cholula y un par de ramales al oriente.
 */

/** Puntos de referencia reales del área metropolitana, para armar los trazos. */
export const REFERENCIAS = {
  capu: { lng: -98.2073, lat: 19.0747, nombre: "CAPU" },
  centro: { lng: -98.1983, lat: 19.0433, nombre: "Zócalo" },
  angelopolis: { lng: -98.237, lat: 19.026, nombre: "Angelópolis" },
  cholula: { lng: -98.303, lat: 19.063, nombre: "Cholula" },
  laMargarita: { lng: -98.148, lat: 19.033, nombre: "La Margarita" },
  amalucan: { lng: -98.154, lat: 19.068, nombre: "Amalucan" },
  cu: { lng: -98.203, lat: 19.0, nombre: "Ciudad Universitaria" },
  zavaleta: { lng: -98.242, lat: 19.047, nombre: "Zavaleta" },
  valsequillo: { lng: -98.18, lat: 18.99, nombre: "Valsequillo" },
  sanSebastian: { lng: -98.19, lat: 19.09, nombre: "Bosques de San Sebastián" },
  parqueLineal: { lng: -98.229, lat: 19.017, nombre: "Parque Lineal" },
  sanManuel: { lng: -98.197, lat: 19.011, nombre: "San Manuel" },
} as const;

type Punto = { lng: number; lat: number };

/**
 * Mete puntos intermedios entre cada par de referencias para que la línea no
 * se vea como un solo segmento recto. Sigue sin ser el trazo real.
 */
function densificar(puntos: readonly Punto[], porTramo = 6): [number, number][] {
  const salida: [number, number][] = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i]!;
    const b = puntos[i + 1]!;
    for (let paso = 0; paso < porTramo; paso++) {
      const t = paso / porTramo;
      // Un zigzag mínimo, para que al pintarlo no parezca una regla.
      const desvio = Math.sin(t * Math.PI) * 0.0012 * (i % 2 === 0 ? 1 : -1);
      salida.push([a.lng + (b.lng - a.lng) * t + desvio, a.lat + (b.lat - a.lat) * t]);
    }
  }
  const ultimo = puntos[puntos.length - 1]!;
  salida.push([ultimo.lng, ultimo.lat]);
  return salida;
}

export const CONCESIONARIAS: Agency[] = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    name: "Red Urbana de Transporte Articulado",
    shortName: "RUTA",
    type: "brt",
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    name: "Autotransportes Unidos de Puebla",
    shortName: "AUP",
    type: "urbano",
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    name: "Transportes del Valle de Cholula",
    shortName: "TVC",
    type: "suburbano",
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    name: "Colectivos Metropolitanos del Oriente",
    shortName: "CMO",
    type: "colectivo",
  },
];

interface Semilla {
  slug: string;
  shortName: string;
  longName: string;
  color: string;
  fareCents: number | null;
  agencyIndex: number;
  waypoints: readonly Punto[];
}

/** Paleta de diez colores distinguibles entre sí y legibles en claro y oscuro. */
const SEMILLAS: Semilla[] = [
  {
    slug: "ruta-linea-1-capu-centro",
    shortName: "L1",
    longName: "RUTA Línea 1 · CAPU – Centro – Valsequillo",
    color: "#E11D48",
    fareCents: 800,
    agencyIndex: 0,
    waypoints: [REFERENCIAS.capu, REFERENCIAS.centro, REFERENCIAS.sanManuel, REFERENCIAS.valsequillo],
  },
  {
    slug: "ruta-linea-2-chachapa-san-ramon",
    shortName: "L2",
    longName: "RUTA Línea 2 · Amalucan – Centro – Zavaleta",
    color: "#2563EB",
    fareCents: 800,
    agencyIndex: 0,
    waypoints: [REFERENCIAS.amalucan, REFERENCIAS.centro, REFERENCIAS.zavaleta],
  },
  {
    slug: "ruta-72-centro-la-margarita",
    shortName: "72",
    longName: "Centro – La Margarita",
    color: "#059669",
    fareCents: 950,
    agencyIndex: 1,
    waypoints: [REFERENCIAS.centro, REFERENCIAS.laMargarita],
  },
  {
    slug: "ruta-10-capu-angelopolis",
    shortName: "10",
    longName: "CAPU – Centro – Angelópolis",
    color: "#D97706",
    fareCents: 950,
    agencyIndex: 1,
    waypoints: [REFERENCIAS.capu, REFERENCIAS.centro, REFERENCIAS.parqueLineal, REFERENCIAS.angelopolis],
  },
  {
    slug: "ruta-25-cholula-centro",
    shortName: "25",
    longName: "Cholula – Zavaleta – Centro",
    color: "#7C3AED",
    fareCents: 1200,
    agencyIndex: 2,
    waypoints: [REFERENCIAS.cholula, REFERENCIAS.zavaleta, REFERENCIAS.centro],
  },
  {
    slug: "ruta-40-cu-angelopolis",
    shortName: "40",
    longName: "Ciudad Universitaria – Angelópolis",
    color: "#0891B2",
    fareCents: 950,
    agencyIndex: 1,
    waypoints: [REFERENCIAS.cu, REFERENCIAS.parqueLineal, REFERENCIAS.angelopolis],
  },
  {
    slug: "ruta-14-san-sebastian-centro",
    shortName: "14",
    longName: "Bosques de San Sebastián – Centro",
    color: "#DB2777",
    fareCents: 950,
    agencyIndex: 1,
    waypoints: [REFERENCIAS.sanSebastian, REFERENCIAS.capu, REFERENCIAS.centro],
  },
  {
    slug: "ruta-63-amalucan-cu",
    shortName: "63",
    longName: "Amalucan – Centro – Ciudad Universitaria",
    color: "#65A30D",
    fareCents: 950,
    agencyIndex: 3,
    waypoints: [REFERENCIAS.amalucan, REFERENCIAS.centro, REFERENCIAS.sanManuel, REFERENCIAS.cu],
  },
  {
    slug: "ruta-31-margarita-angelopolis",
    shortName: "31",
    longName: "La Margarita – Centro – Angelópolis",
    color: "#EA580C",
    fareCents: 1000,
    agencyIndex: 3,
    waypoints: [REFERENCIAS.laMargarita, REFERENCIAS.centro, REFERENCIAS.angelopolis],
  },
  {
    slug: "ruta-8-capu-cholula",
    shortName: "8",
    longName: "CAPU – Zavaleta – Cholula",
    color: "#4F46E5",
    fareCents: 1200,
    agencyIndex: 2,
    waypoints: [REFERENCIAS.capu, REFERENCIAS.zavaleta, REFERENCIAS.cholula],
  },
];

const uuid = (n: number, prefijo: string) =>
  `${prefijo}-2222-4222-8222-${String(n).padStart(12, "0")}`;

/** Longitud aproximada de una polilínea, en metros. */
function longitudM(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i]!;
    const [lng2, lat2] = coords[i + 1]!;
    const latMedia = ((lat1 + lat2) / 2) * (Math.PI / 180);
    const dx = (lng2 - lng1) * 111_320 * Math.cos(latMedia);
    const dy = (lat2 - lat1) * 110_540;
    total += Math.hypot(dx, dy);
  }
  return Math.round(total);
}

export interface RutaSimulada extends RouteDetail {
  /** Geometría por variante, en el orden de `variants`. */
  geometrias: [number, number][][];
}

const RUTAS_SINTETICAS: RutaSimulada[] = SEMILLAS.map((semilla, i) => {
  const ida = densificar(semilla.waypoints);
  const vuelta = [...ida].reverse();
  const routeId = uuid(i + 1, "33333333");
  const agencia = CONCESIONARIAS[semilla.agencyIndex]!;
  const conCalificaciones = i % 3 !== 2; // una de cada tres sin calificar aún

  return {
    id: routeId,
    slug: semilla.slug,
    shortName: semilla.shortName,
    longName: semilla.longName,
    color: semilla.color,
    textColor: "#FFFFFF",
    colorSecondary: null,
    basin: null,
    denominations: [],
    fareCents: semilla.fareCents,
    status: "published",
    agency: agencia,
    dataSource: agencia.type === "brt" ? "official" : "manual",
    updatedAt: "2026-09-28T18:00:00.000Z",
    variants: [
      {
        id: uuid(i * 2 + 1, "44444444"),
        routeId,
        name: "Ida",
        direction: 0,
        lengthM: longitudM(ida),
        isPrimary: true,
      },
      {
        id: uuid(i * 2 + 2, "44444444"),
        routeId,
        name: "Vuelta",
        direction: 1,
        lengthM: longitudM(vuelta),
        isPrimary: false,
      },
    ],
    ratingStats: conCalificaciones
      ? {
          ratingsCount: 12 + i * 7,
          avgOverall: Number((3.1 + ((i * 7) % 17) / 10).toFixed(2)),
          avgSafety: Number((2.8 + ((i * 11) % 19) / 10).toFixed(2)),
          avgCleanliness: Number((3.0 + ((i * 13) % 15) / 10).toFixed(2)),
          avgDriver: Number((2.9 + ((i * 5) % 18) / 10).toFixed(2)),
          avgDriving: Number((2.6 + ((i * 3) % 20) / 10).toFixed(2)),
          avgFrequency: Number((3.3 + ((i * 17) % 14) / 10).toFixed(2)),
          bayesianScore: Number((3.4 + ((i * 7) % 11) / 10).toFixed(2)),
        }
      : null,
    geometrias: [ida, vuelta],
  };
});

/**
 * En cuanto existe al menos una ruta trazada a mano en `data/rutas/`, las
 * sintéticas desaparecen. Así el mapa muestra exactamente lo que es real y
 * nadie confunde una línea recta inventada con un recorrido verificado.
 *
 * Para agregar una ruta: ver `data/rutas/README.md`.
 */
export const HAY_RUTAS_TRAZADAS = rutasReales.rutas.length > 0;

export const RUTAS: RutaSimulada[] = HAY_RUTAS_TRAZADAS
  ? (rutasReales.rutas as unknown as RutaSimulada[])
  : RUTAS_SINTETICAS;

export const CONCESIONARIAS_ACTIVAS: Agency[] = HAY_RUTAS_TRAZADAS
  ? (rutasReales.concesionarias as Agency[])
  : CONCESIONARIAS;

export const RUTAS_RESUMEN: RouteSummary[] = RUTAS.map(
  ({
    id, slug, shortName, longName, color, textColor,
    colorSecondary, basin, denominations, fareCents, status, agency,
  }) => ({
    id, slug, shortName, longName, color, textColor,
    colorSecondary: colorSecondary ?? null,
    basin: basin ?? null,
    denominations: denominations ?? [],
    fareCents, status, agency,
  }),
);

/** Una parada de referencia por cada punto conocido del corredor. */
export const PARADAS: Stop[] = Object.values(REFERENCIAS).map((ref, i) => ({
  id: uuid(i + 1, "55555555"),
  name: ref.nombre,
  kind: i < 2 ? "terminal" : i < 5 ? "formal" : "informal",
  lat: ref.lat,
  lng: ref.lng,
}));
