import { RouteList } from "@/components/routes/route-list";
import { TopBar } from "@/components/layout/top-bar";

export const metadata = {
  title: "Rutas",
  description: "Catálogo de rutas del transporte público de Puebla.",
};

export default function RutasPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar titulo="Rutas" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">
          <RouteList />
        </div>
      </div>
    </div>
  );
}
