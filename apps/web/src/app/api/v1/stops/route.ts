import { paradasEn } from "@/datos/consultas";
import { ok } from "@/server/respuestas";

/** `GET /api/v1/stops?bbox=oeste,sur,este,norte` */
export async function GET(peticion: Request) {
  const bbox = new URL(peticion.url).searchParams.get("bbox");
  return ok(paradasEn(bbox), 3600);
}
