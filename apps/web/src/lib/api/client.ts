import type { z } from "zod";

import { API_BASE, env } from "@/lib/env";

import { ApiError, leerProblem } from "./errors";

/**
 * Cliente HTTP del contrato de API v1.
 *
 * Tres cosas que hace y que vale la pena no perder:
 *
 * 1. **Valida toda respuesta contra su esquema Zod.** Si el backend cambia un
 *    campo, falla aquí con un mensaje claro, en vez de propagar `undefined`
 *    hasta que una pantalla muestre "NaN km" y nadie sepa por qué.
 * 2. **Pone un tiempo límite.** En 4G, una petición que se queda colgada para
 *    siempre es peor que una que falla: al menos la que falla se puede
 *    reintentar.
 * 3. **Normaliza los errores** a `ApiError`, con un tipo que distingue red de
 *    servidor de contrato. De ahí sale la política de reintento.
 */

const TIEMPO_LIMITE_MS = 10_000;

/**
 * Con MSW encendido, espera a que el worker esté interceptando antes de
 * soltar la primera petición. Si sale antes, se va a la red real y responde
 * 404 o CORS: el usuario ve un error que no existe.
 *
 * La espera va aquí, en el transporte, y no envolviendo el render. Medido:
 * bloquear el árbol hasta que el worker arranque empujaba el LCP de 650 ms a
 * casi 3 000 ms, porque ni siquiera el esqueleto podía pintarse. Así la
 * pantalla aparece de inmediato y lo único que espera es el dato.
 */
async function esperarMocks(): Promise<void> {
  if (!env.NEXT_PUBLIC_ENABLE_MOCKS) return;
  if (typeof window === "undefined") return;
  await window.__combiajeMocksListos;
}

type ParametrosConsulta = Record<string, string | number | boolean | null | undefined>;

export interface OpcionesPeticion {
  /** Para cancelar desde TanStack Query cuando el componente se desmonta. */
  signal?: AbortSignal;
  /** JWT de Supabase, para los endpoints marcados con 🔒. */
  token?: string;
  timeoutMs?: number;
}

function construirUrl(ruta: string, params?: ParametrosConsulta): string {
  const url = new URL(`${API_BASE}${ruta}`);
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor === null || valor === undefined || valor === "") continue;
      url.searchParams.set(clave, String(valor));
    }
  }
  return url.toString();
}

/**
 * Une la señal de cancelación de quien llama con la del tiempo límite, para
 * que cualquiera de las dos aborte la petición.
 */
function senalCombinada(propia: AbortSignal, externa?: AbortSignal): AbortSignal {
  return externa ? AbortSignal.any([propia, externa]) : propia;
}

async function peticion<T extends z.ZodType>(
  metodo: "GET" | "POST" | "DELETE",
  ruta: string,
  esquema: T,
  opciones: OpcionesPeticion & { params?: ParametrosConsulta; cuerpo?: unknown } = {},
): Promise<z.infer<T>> {
  const url = construirUrl(ruta, opciones.params);
  const porTiempo = AbortSignal.timeout(opciones.timeoutMs ?? TIEMPO_LIMITE_MS);

  const cabeceras: Record<string, string> = { Accept: "application/json" };
  if (opciones.cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (opciones.token) cabeceras["Authorization"] = `Bearer ${opciones.token}`;

  await esperarMocks();

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cabeceras,
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      signal: senalCombinada(porTiempo, opciones.signal),
    });
  } catch (causa) {
    const esTiempo = causa instanceof DOMException && causa.name === "TimeoutError";
    throw new ApiError({
      kind: esTiempo ? "timeout" : "network",
      message: esTiempo ? `Tiempo agotado: ${url}` : `No se pudo alcanzar ${url}`,
      url,
      cause: causa,
    });
  }

  if (!respuesta.ok) {
    const problem = await leerProblem(respuesta);
    throw new ApiError({
      kind: respuesta.status >= 500 ? "server" : "client",
      message: problem?.title ?? `${respuesta.status} ${respuesta.statusText} en ${url}`,
      url,
      status: respuesta.status,
      problem,
    });
  }

  if (respuesta.status === 204) return esquema.parse(undefined) as z.infer<T>;

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch (causa) {
    throw new ApiError({
      kind: "contract",
      message: `La respuesta de ${url} no es JSON válido`,
      url,
      status: respuesta.status,
      cause: causa,
    });
  }

  const validado = esquema.safeParse(cuerpo);
  if (!validado.success) {
    // El detalle completo solo a la consola: al usuario le toca el mensaje
    // amable de ApiError.
    console.error(`[combiaje] La respuesta de ${url} no cumple el contrato`, validado.error.issues);
    throw new ApiError({
      kind: "contract",
      message: `La respuesta de ${url} no cumple el contrato`,
      url,
      status: respuesta.status,
      cause: validado.error,
    });
  }

  return validado.data as z.infer<T>;
}

export const api = {
  get: <T extends z.ZodType>(
    ruta: string,
    esquema: T,
    opciones?: OpcionesPeticion & { params?: ParametrosConsulta },
  ) => peticion("GET", ruta, esquema, opciones),

  post: <T extends z.ZodType>(
    ruta: string,
    esquema: T,
    cuerpo: unknown,
    opciones?: OpcionesPeticion,
  ) => peticion("POST", ruta, esquema, { ...opciones, cuerpo }),

  delete: <T extends z.ZodType>(ruta: string, esquema: T, opciones?: OpcionesPeticion) =>
    peticion("DELETE", ruta, esquema, opciones),
};
