import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="grid size-full place-items-center">
      <EmptyState
        icon={MapPinOff}
        titulo="Esta página no existe"
        descripcion="Puede que la ruta haya cambiado de nombre o que el enlace esté incompleto."
        accion={
          <Button asChild>
            <Link href="/">Ir al mapa</Link>
          </Button>
        }
      />
    </div>
  );
}
