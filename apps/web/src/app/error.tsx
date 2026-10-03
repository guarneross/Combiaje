"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción esto lo recoge Sentry; en local, la consola basta.
    console.error("[combiaje]", error);
  }, [error]);

  return (
    <div className="grid size-full place-items-center">
      <ErrorState
        titulo="Algo se rompió de nuestro lado"
        descripcion="No es tu conexión. Vuelve a intentar; si sigue igual, inténtalo en un rato."
        detalle={error.message}
        onReintentar={reset}
      />
    </div>
  );
}
