import { geojsonDeRuta } from "@/datos/consultas";
import { noEncontrada, ok } from "@/server/respuestas";

/** `GET /api/v1/routes/:slug/geojson` */
export async function GET(_peticion: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const geojson = geojsonDeRuta(slug);
  if (!geojson) return noEncontrada(slug);
  return ok(geojson, 3600);
}
