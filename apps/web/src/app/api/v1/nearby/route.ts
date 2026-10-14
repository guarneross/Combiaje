import { rutasCercanas } from "@/datos/consultas";
import { ok, problema } from "@/server/respuestas";

/**
 * `GET /api/v1/nearby?lat=&lng=&radius=&limit=`
 *
 * ⚠️ **La ubicación no se guarda.** Entra, se usa para calcular distancias y
 * se descarta con la petición. No hay bitácora de coordenadas, ni analítica,
 * ni caché por usuario. Saber por dónde anda la gente no es parte del trato.
 * Por eso tampoco se cachea esta respuesta.
 */
export async function GET(peticion: Request) {
  const p = new URL(peticion.url).searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return problema(422, "Faltan las coordenadas", "lat y lng son obligatorios y numéricos.");
  }

  return ok(
    rutasCercanas({
      lat,
      lng,
      radius: Number(p.get("radius") ?? 0) || undefined,
      limit: Number(p.get("limit") ?? 0) || undefined,
    }),
  );
}
