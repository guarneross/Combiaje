import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import { baseRules, ignores } from "@combiaje/config/eslint";

/**
 * eslint-config-next 16 ya exporta configuración plana: nada de FlatCompat.
 */
const config = [
  { ignores: [...ignores, "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      ...baseRules,
      // La atribución a OSM puede ir en un <img> plano; no es contenido crítico.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
