export {};

declare global {
  interface Window {
    /**
     * Promesa que resuelve cuando Mock Service Worker ya está interceptando.
     * La crea `src/instrumentation-client.ts`; la espera el cliente HTTP
     * antes de soltar la primera petición.
     */
    __combiajeMocksListos?: Promise<void>;
  }
}
