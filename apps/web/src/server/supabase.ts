import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Conexión a Supabase, desde el servidor.
 *
 * **Aquí no hay llave de servicio.** El servidor usa la misma llave pública
 * que usaría el navegador y, cuando la petición trae sesión, se la pasa tal
 * cual. Quien decide qué fila puede tocar cada quien es la seguridad a nivel
 * de fila de Postgres, no este código.
 *
 * Eso es deliberado. Una llave de servicio se salta todas las políticas: basta
 * con que se cuele en un log, en un commit o en una variable mal puesta para
 * que cualquiera pueda borrar o falsificar calificaciones. Si no existe, no se
 * puede filtrar. El costo es que todas las reglas tienen que estar escritas en
 * la migración —y ahí están.
 *
 * Tampoco hay conexión directa a Postgres. En hosting compartido, Passenger
 * levanta y mata procesos a su antojo, y cada proceso con su propio pool de
 * conexiones es la forma clásica de agotar el límite de la capa gratuita.
 * Aquí todo va por HTTP.
 */

/**
 * ¿Está configurada la base?
 *
 * Mientras no lo esté, la aplicación funciona igual: el mapa, el catálogo y
 * las fichas no dependen de Postgres. Lo único que no existe son las
 * calificaciones, y las pantallas ya saben decir «todavía nadie la ha
 * calificado». Desarrollar sin base de datos tiene que seguir siendo posible.
 */
export function hayBaseDeDatos(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function crear(cabeceras?: Record<string, string>): SupabaseClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(cabeceras ? { global: { headers: cabeceras } } : {}),
  });
}

/** Para leer lo público: promedios y comentarios visibles. */
export function clienteAnonimo(): SupabaseClient {
  return crear();
}

/**
 * Para actuar **como quien hizo la petición**. El token viaja a Postgres y
 * `auth.uid()` dentro de las políticas es esa persona.
 */
export function clienteConSesion(jwt: string): SupabaseClient {
  return crear({ Authorization: `Bearer ${jwt}` });
}

/** Saca el token de `Authorization: Bearer …`. `null` si no viene. */
export function tokenDe(peticion: Request): string | null {
  const cabecera = peticion.headers.get("authorization") ?? "";
  const [esquema, valor] = cabecera.split(" ");
  if (esquema?.toLowerCase() !== "bearer" || !valor) return null;
  return valor.trim() || null;
}
