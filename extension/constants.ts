/**
 * Default API origin for the SuperTunnel backend.
 *
 * Vite replaces `import.meta.env.VITE_API_ORIGIN` at build time with
 * the value from the .env file. No runtime guard needed.
 */
export const DEFAULT_API_ORIGIN: string =
  import.meta.env.VITE_API_ORIGIN || "https://api.supertunnel.example";
