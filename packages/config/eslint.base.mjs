// Reglas comunes a todo el monorepo. Cada paquete las extiende.
export const ignores = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/public/**",
];

export const baseRules = {
  // Un import sin usar en una PR de tres días es ruido; que falle el lint.
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "no-console": ["warn", { allow: ["warn", "error"] }],
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
};
