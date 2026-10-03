import { problemSchema, type Problem } from "@combiaje/shared";

/**
 * Error de la API, ya normalizado.
 *
 * La diferencia entre "no hay internet", "el servidor tronó" y "la respuesta
 * no cuadra con el contrato" importa: la primera se reintenta, la segunda se
 * reintenta una vez, y la tercera es un bug nuestro o del backend que hay que
 * ver, no reintentar.
 */
export type ApiErrorKind =
  /** No hubo respuesta: sin red, DNS, CORS, o la petición se canceló. */
  | "network"
  /** Se agotó el tiempo de espera. */
  | "timeout"
  /** 4xx: la petición está mal o el recurso no existe. */
  | "client"
  /** 5xx: el servidor falló. */
  | "server"
  /** Respondió, pero la forma no cuadra con el esquema del contrato. */
  | "contract";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly problem: Problem | null;
  readonly url: string;

  constructor(opciones: {
    kind: ApiErrorKind;
    message: string;
    url: string;
    status?: number | null;
    problem?: Problem | null;
    cause?: unknown;
  }) {
    super(opciones.message, { cause: opciones.cause });
    this.name = "ApiError";
    this.kind = opciones.kind;
    this.status = opciones.status ?? null;
    this.problem = opciones.problem ?? null;
    this.url = opciones.url;
  }

  /** ¿Tiene sentido volver a intentar? Un 404 no mejora por insistir. */
  get esReintentable(): boolean {
    if (this.kind === "network" || this.kind === "timeout") return true;
    if (this.kind === "server") return true;
    // 408 Request Timeout y 429 Too Many Requests sí se reintentan.
    if (this.kind === "client") return this.status === 408 || this.status === 429;
    return false;
  }

  /** Mensaje para el usuario. Nada de códigos ni jerga. */
  get mensajeParaUsuario(): string {
    switch (this.kind) {
      case "network":
        return "No hay conexión. Revisa tus datos o tu WiFi.";
      case "timeout":
        return "La conexión está muy lenta. Vuelve a intentar.";
      case "client":
        if (this.status === 404) return "No encontramos lo que buscas.";
        if (this.status === 429) return "Demasiadas búsquedas seguidas. Espera un momento.";
        return this.problem?.title ?? "Algo salió mal con la búsqueda.";
      case "server":
        return "El servidor no está respondiendo bien. Inténtalo en un momento.";
      case "contract":
        return "Recibimos una respuesta que no entendimos. Ya lo estamos viendo.";
    }
  }
}

/** Intenta leer un cuerpo `application/problem+json`. Si no se puede, null. */
export async function leerProblem(respuesta: Response): Promise<Problem | null> {
  try {
    const cuerpo: unknown = await respuesta.json();
    const resultado = problemSchema.safeParse(cuerpo);
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}
