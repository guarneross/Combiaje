import { buscarRutas } from "@/datos/consultas";
import { ok } from "@/server/respuestas";

/** `GET /api/v1/routes?q=&agency=&page=&limit=` */
export async function GET(peticion: Request) {
  const p = new URL(peticion.url).searchParams;
  return ok(
    buscarRutas({
      q: p.get("q"),
      agency: p.get("agency"),
      page: Number(p.get("page") ?? 1),
      limit: Number(p.get("limit") ?? 0) || undefined,
    }),
    300,
  );
}
