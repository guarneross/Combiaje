import { Bus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { TopBar } from "@/components/layout/top-bar";

export const metadata = { title: "Unidades" };

export default function UnidadesPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar titulo="Unidades" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState
          icon={Bus}
          titulo="Calificar unidades es del hito M3"
          descripcion="Buscarás una unidad por su número económico y la calificarás en seguridad, limpieza, trato y manejo."
        />
      </div>
    </div>
  );
}
