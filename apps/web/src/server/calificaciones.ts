import type { Rating, RatingSort, RouteRatingStats } from "@combiaje/shared";

import { clienteAnonimo, clienteConSesion, hayBaseDeDatos } from "./supabase";

/**
 * Acceso a las calificaciones. Es lo único que vive en Postgres.
 *
 * Las columnas de la base van en `snake_case` y el contrato de API en
 * `camelCase`. La traducción ocurre **aquí y en ningún otro lado**: el resto
 * de la aplicación nunca ve un `avg_overall`.
 */

/** Fila tal como sale de la base. */
interface FilaCalificacion {
  id: string;
  user_id: string;
  route_slug: string;
  overall: number;
  safety: number | null;
  cleanliness: number | null;
  driver: number | null;
  driving: number | null;
  frequency: number | null;
  vehicle_number: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

const aCalificacion = (fila: FilaCalificacion, miUsuario?: string | null): Rating => ({
  id: fila.id,
  routeSlug: fila.route_slug,
  overall: fila.overall,
  safety: fila.safety,
  cleanliness: fila.cleanliness,
  driver: fila.driver,
  driving: fila.driving,
  frequency: fila.frequency,
  vehicleNumber: fila.vehicle_number,
  comment: fila.comment,
  createdAt: new Date(fila.created_at).toISOString(),
  updatedAt: new Date(fila.updated_at).toISOString(),
  esMia: Boolean(miUsuario) && fila.user_id === miUsuario,
});

/**
 * Promedios de una ruta.
 *
 * Devuelve `null` —no ceros— cuando nadie ha calificado, y también cuando la
 * base no está configurada o no responde. Un promedio de cero sería mentira; y
 * que la base se caiga no debe tumbar la ficha de la ruta, que es información
 * útil por sí sola.
 */
export async function estadisticasDeRuta(slug: string): Promise<RouteRatingStats | null> {
  if (!hayBaseDeDatos()) return null;

  const { data, error } = await clienteAnonimo()
    .from("route_rating_stats")
    .select("*")
    .eq("route_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[combiaje] no se pudieron leer los promedios", error.message);
    return null;
  }
  if (!data) return null;

  return {
    ratingsCount: data.ratings_count,
    avgOverall: data.avg_overall,
    avgSafety: data.avg_safety,
    avgCleanliness: data.avg_cleanliness,
    avgDriver: data.avg_driver,
    avgDriving: data.avg_driving,
    avgFrequency: data.avg_frequency,
    bayesianScore: data.bayesian_score,
  };
}

const ORDEN: Record<RatingSort, { columna: string; ascendente: boolean }> = {
  recientes: { columna: "created_at", ascendente: false },
  mejores: { columna: "overall", ascendente: false },
  peores: { columna: "overall", ascendente: true },
};

/**
 * `GET /routes/:slug/ratings`
 *
 * Solo trae las que tienen comentario: una lista de estrellas sueltas sin
 * texto no le dice nada a nadie, y para eso están los promedios.
 */
export async function listarCalificaciones(
  slug: string,
  opciones: { page?: number; limit?: number; sort?: RatingSort; jwt?: string | null } = {},
) {
  const page = Math.max(1, opciones.page ?? 1);
  const limit = Math.min(50, Math.max(1, opciones.limit ?? 20));
  const orden = ORDEN[opciones.sort ?? "recientes"];

  if (!hayBaseDeDatos()) {
    return { items: [] as Rating[], page, limit, total: 0, totalPages: 1 };
  }

  // Con sesión, la consulta va como esa persona para poder marcar cuál es la
  // suya. Sin sesión, anónima.
  const cliente = opciones.jwt ? clienteConSesion(opciones.jwt) : clienteAnonimo();
  const miUsuario = opciones.jwt ? ((await cliente.auth.getUser()).data.user?.id ?? null) : null;

  const desde = (page - 1) * limit;
  const { data, error, count } = await cliente
    .from("ratings")
    .select("*", { count: "exact" })
    .eq("route_slug", slug)
    .not("comment", "is", null)
    .order(orden.columna, { ascending: orden.ascendente })
    .range(desde, desde + limit - 1);

  if (error) {
    console.error("[combiaje] no se pudieron leer las calificaciones", error.message);
    return { items: [] as Rating[], page, limit, total: 0, totalPages: 1 };
  }

  const total = count ?? 0;
  return {
    items: (data as FilaCalificacion[]).map((f) => aCalificacion(f, miUsuario)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export interface DatosCalificacion {
  overall: number;
  safety?: number | null;
  cleanliness?: number | null;
  driver?: number | null;
  driving?: number | null;
  frequency?: number | null;
  vehicleNumber?: string | null;
  comment?: string | null;
}

export type ResultadoGuardar =
  | { ok: true; calificacion: Rating; creada: boolean }
  | { ok: false; motivo: "sin-sesion" | "sin-base" | "error"; detalle?: string };

/**
 * `POST /routes/:slug/ratings`
 *
 * Crea o **actualiza**: una persona, una opinión por ruta, siempre corregible.
 * El `user_id` sale del token, nunca del cuerpo de la petición — si viniera de
 * ahí, cualquiera podría calificar en nombre de otro.
 */
export async function guardarCalificacion(
  jwt: string | null,
  slug: string,
  datos: DatosCalificacion,
): Promise<ResultadoGuardar> {
  if (!hayBaseDeDatos()) return { ok: false, motivo: "sin-base" };
  if (!jwt) return { ok: false, motivo: "sin-sesion" };

  const cliente = clienteConSesion(jwt);
  const { data: sesion } = await cliente.auth.getUser();
  const usuario = sesion.user;
  if (!usuario) return { ok: false, motivo: "sin-sesion" };

  const yaTenia = await cliente
    .from("ratings")
    .select("id")
    .eq("route_slug", slug)
    .eq("user_id", usuario.id)
    .maybeSingle();

  const { data, error } = await cliente
    .from("ratings")
    .upsert(
      {
        user_id: usuario.id,
        route_slug: slug,
        overall: datos.overall,
        safety: datos.safety ?? null,
        cleanliness: datos.cleanliness ?? null,
        driver: datos.driver ?? null,
        driving: datos.driving ?? null,
        frequency: datos.frequency ?? null,
        vehicle_number: datos.vehicleNumber ?? null,
        comment: datos.comment ?? null,
      },
      { onConflict: "user_id,route_slug" },
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("[combiaje] no se pudo guardar la calificación", error?.message);
    return { ok: false, motivo: "error", detalle: error?.message };
  }

  return {
    ok: true,
    creada: !yaTenia.data,
    calificacion: aCalificacion(data as FilaCalificacion, usuario.id),
  };
}

/**
 * `DELETE /ratings/:id`
 *
 * No hace falta comprobar de quién es: la política de la base solo deja
 * borrar las propias. Si no era suya, no borra nada y devuelve `false`.
 */
export async function borrarCalificacion(jwt: string | null, id: string): Promise<boolean> {
  if (!hayBaseDeDatos() || !jwt) return false;

  const { data, error } = await clienteConSesion(jwt)
    .from("ratings")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[combiaje] no se pudo borrar la calificación", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
