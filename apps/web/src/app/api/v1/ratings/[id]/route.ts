import { borrarCalificacion } from "@/server/calificaciones";
import { problema, sinSesion } from "@/server/respuestas";
import { tokenDe } from "@/server/supabase";

/**
 * `DELETE /api/v1/ratings/:id` 🔒
 *
 * Quien escribió una opinión puede retirarla. No se comprueba aquí de quién
 * es: la política de la base solo deja borrar las propias, así que intentar
 * borrar la de otro simplemente no borra nada — y se responde 404, no 403,
 * para no confirmarle a nadie que ese identificador existe.
 */
export async function DELETE(peticion: Request, ctx: { params: Promise<{ id: string }> }) {
  const jwt = tokenDe(peticion);
  if (!jwt) return sinSesion();

  const { id } = await ctx.params;
  const borrada = await borrarCalificacion(jwt, id);

  if (!borrada) {
    return problema(404, "No encontramos esa calificación", "O no existe, o no es tuya.");
  }

  return new Response(null, { status: 204 });
}
