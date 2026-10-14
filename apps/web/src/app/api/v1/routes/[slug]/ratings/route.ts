import { ratingCreateSchema, ratingSortSchema } from "@combiaje/shared";

import { existeRuta } from "@/datos/consultas";
import { guardarCalificacion, listarCalificaciones } from "@/server/calificaciones";
import { noEncontrada, ok, problema, sinBase, sinSesion } from "@/server/respuestas";
import { hayBaseDeDatos, tokenDe } from "@/server/supabase";

/** `GET /api/v1/routes/:slug/ratings?page=&sort=` — reseñas con texto. */
export async function GET(peticion: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!existeRuta(slug)) return noEncontrada(slug);

  const p = new URL(peticion.url).searchParams;
  const orden = ratingSortSchema.safeParse(p.get("sort") ?? undefined);

  return ok(
    await listarCalificaciones(slug, {
      page: Number(p.get("page") ?? 1),
      limit: Number(p.get("limit") ?? 0) || undefined,
      sort: orden.success ? orden.data : "recientes",
      jwt: tokenDe(peticion),
    }),
  );
}

/**
 * `POST /api/v1/routes/:slug/ratings` 🔒
 *
 * Crea o actualiza la calificación de quien manda el token. Dos cosas que no
 * se negocian:
 *
 * - **El autor sale del token**, nunca del cuerpo. Si viniera del cuerpo,
 *   cualquiera podría calificar en nombre de otro.
 * - **La ruta tiene que existir** en el dataset. Como las rutas no están en
 *   Postgres, no hay llave foránea que lo impida: esta comprobación es lo que
 *   evita que la base se llene de calificaciones a rutas inventadas.
 */
export async function POST(peticion: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!existeRuta(slug)) return noEncontrada(slug);
  if (!hayBaseDeDatos()) return sinBase();

  const jwt = tokenDe(peticion);
  if (!jwt) return sinSesion();

  const cuerpo = await peticion.json().catch(() => null);
  const datos = ratingCreateSchema.safeParse(cuerpo);
  if (!datos.success) {
    return problema(
      422,
      "La calificación no es válida",
      datos.error.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`).join("; "),
    );
  }

  const resultado = await guardarCalificacion(jwt, slug, datos.data);

  if (!resultado.ok) {
    if (resultado.motivo === "sin-sesion") return sinSesion();
    if (resultado.motivo === "sin-base") return sinBase();
    return problema(500, "No pudimos guardar tu calificación", resultado.detalle);
  }

  return Response.json(resultado.calificacion, { status: resultado.creada ? 201 : 200 });
}
