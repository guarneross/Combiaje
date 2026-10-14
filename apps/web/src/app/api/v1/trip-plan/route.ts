import { planearViaje } from "@/datos/consultas";
import { ok, problema } from "@/server/respuestas";

/** `POST /api/v1/trip-plan` — solo viajes directos, ver `datos/consultas.ts`. */
export async function POST(peticion: Request) {
  const cuerpo = (await peticion.json().catch(() => null)) as {
    origin?: { lat: number; lng: number };
    destination?: { lat: number; lng: number };
    maxWalkM?: number;
  } | null;

  if (!cuerpo?.origin || !cuerpo.destination) {
    return problema(422, "Faltan origen o destino");
  }

  return ok(
    planearViaje({
      origin: cuerpo.origin,
      destination: cuerpo.destination,
      ...(cuerpo.maxWalkM ? { maxWalkM: cuerpo.maxWalkM } : {}),
    }),
  );
}
