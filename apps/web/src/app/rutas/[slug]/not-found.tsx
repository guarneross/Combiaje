import Link from "next/link";
import { BusFront } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ruta no encontrada" };

/**
 * No encontrada para `/rutas/[slug]`.
 *
 * La diferencia con la de la aplicación completa es el mensaje: aquí sabemos
 * que la persona buscaba *una ruta*, y lo más probable no es que el enlace
 * esté roto, sino que esa ruta todavía no está trazada. Decirlo así es más
 * honesto que «esta página no existe», y el botón lleva al catálogo en vez de
 * al mapa.
 */
export default function RutaNoEncontrada() {
  return (
    <div className="flex h-full flex-col">
      <TopBar titulo="Ruta no encontrada" volverA="/rutas" />
      <div className="grid flex-1 place-items-center p-4">
        <EmptyState
          icon={BusFront}
          titulo="Esta ruta todavía no está en Combiaje"
          descripcion="Puede que no la hayamos trazado o que haya cambiado de número con la renumeración. Busca por su nombre o por una calle por la que pase."
          accion={
            <Button asChild>
              <Link href="/rutas">Ver todas las rutas</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
