"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bus, CircleUser, Map, Route, Signpost } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Mapa", icon: Map },
  { href: "/rutas", label: "Rutas", icon: Route },
  { href: "/planear", label: "Planear", icon: Signpost },
  { href: "/unidades", label: "Unidades", icon: Bus },
  { href: "/perfil", label: "Perfil", icon: CircleUser },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-background/95 pb-safe border-border/80 relative z-30 border-t backdrop-blur-sm md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const activo = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  activo ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" strokeWidth={activo ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-background border-border/80 hidden w-16 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex lg:w-56 lg:items-stretch lg:px-3"
    >
      <Link
        href="/"
        className="mb-3 flex items-center gap-2 px-1 lg:px-2"
        aria-label="Combiaje, inicio"
      >
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
        >
          C
        </span>
        <span className="hidden text-base font-semibold tracking-tight lg:inline">Combiaje</span>
      </Link>

      <ul className="flex w-full flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const activo = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                title={label}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-3 rounded-md px-2 text-sm font-medium transition-colors lg:justify-start lg:px-3",
                  activo
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
