import { CircleUser } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { TopBar } from "@/components/layout/top-bar";

export const metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar titulo="Perfil" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState
          icon={CircleUser}
          titulo="La sesión llega con el hito M3"
          descripcion="Entrarás con Google o con un enlace mágico, y aquí verás tus calificaciones y tus aportaciones."
        />
      </div>
    </div>
  );
}
