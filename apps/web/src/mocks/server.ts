import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** Para Vitest (bloque 6) y para cualquier render del servidor que pida datos. */
export const server = setupServer(...handlers);
