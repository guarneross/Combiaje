import { rutaPorSlug } from "@/datos/consultas";
import { estadisticasDeRuta } from "@/server/calificaciones";
import { noEncontrada, ok } from "@/server/respuestas";

/**
 * `GET /api/v1/routes/:slug`
 *
 * Aquí se juntan las dos mitades del proyecto: la ruta sale de los archivos
 * versionados en git y sus promedios, de Postgres. Si la base no responde, los
 * promedios llegan en `null` y la ficha se pinta igual — que es exactamente lo
 * que se buscaba al dejar las rutas fuera de la base.
 */
export async function GET(_peticion: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ruta = rutaPorSlug(slug);
  if (!ruta) return noEncontrada(slug);

  const ratingStats = await estadisticasDeRuta(slug);
  return ok({ ...ruta, ratingStats });
}
