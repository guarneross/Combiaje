import { concesionarias } from "@/datos/consultas";
import { ok } from "@/server/respuestas";

/** `GET /api/v1/agencies` */
export async function GET() {
  return ok(concesionarias(), 3600);
}
