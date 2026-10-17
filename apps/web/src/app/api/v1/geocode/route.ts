import { GEOCODE_MAX_LIMIT, GEOCODE_MIN_LENGTH } from "@combiaje/shared";

import { buscarLugares } from "@/server/geocodificador";
import { ok, problema } from "@/server/respuestas";

/**
 * `GET /api/v1/geocode?q=` — buscar un lugar al que ir.
 *
 * Toda la explicación está en `src/server/geocodificador.ts`. Aquí solo queda
 * lo del transporte, y dos decisiones que se ven desde fuera:
 *
 * - **Se cachea un día.** Dónde está la colonia San Ramón no cambia, y cada
 *   respuesta guardada es una petición menos a un servicio gratuito ajeno.
 *   La consulta va en la URL, así que la caché compartida es de la consulta,
 *   no de la persona: no hay nada que identifique a nadie.
 * - **Nunca falla por culpa del buscador externo.** Si Photon no contesta,
 *   esto responde 200 con los lugares propios y `partial: true`.
 */

const UN_DIA = 86_400;

export async function GET(peticion: Request) {
  const parametros = new URL(peticion.url).searchParams;
  const q = (parametros.get("q") ?? "").trim();

  if (q.length < GEOCODE_MIN_LENGTH) {
    return problema(
      422,
      "Escribe un poco más",
      `La búsqueda necesita al menos ${GEOCODE_MIN_LENGTH} letras.`,
    );
  }

  const pedido = Number(parametros.get("limit") ?? 0);
  const limit = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, GEOCODE_MAX_LIMIT) : undefined;

  const lugares = await buscarLugares({ q, ...(limit ? { limit } : {}) });

  // Si solo pudimos contestar con lo nuestro, no se guarda: dentro de un rato
  // el buscador externo seguramente ya responde.
  return ok(lugares, lugares.partial ? 0 : UN_DIA);
}
