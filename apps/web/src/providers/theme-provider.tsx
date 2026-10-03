"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Único uso legítimo de localStorage en todo el proyecto: la preferencia de
 * tema. Es local, es del dispositivo y no necesita sobrevivir ni compartirse.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
