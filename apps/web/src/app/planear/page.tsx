import { Signpost } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { TopBar } from "@/components/layout/top-bar";

export const metadata = { title: "Planear un viaje" };

export default function PlanearPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar titulo="Planear un viaje" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState
          icon={Signpost}
          titulo="El planificador es del hito M4"
          descripcion="Escribirás a dónde vas y te diremos qué camión te lleva, con cuánto caminas al inicio y al final."
        />
      </div>
    </div>
  );
}
