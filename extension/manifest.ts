/**
 * MV3 manifest for SuperTunnel extension.
 *
 * This file is imported by vite.config.ts (Node/CJS context), NOT bundled
 * as ESM. The @crxjs/vite-plugin has built-in handling for process.env
 * substitution in manifest files, so process.env is correct here.
 *
 * NOTE: background.ts uses import.meta.env because it IS bundled as ESM.
 */
const apiOrigin: string =
  process.env.VITE_API_ORIGIN || "https://api.supertunnel.example";

function withSlashStar(origin: string): string {
  return origin.endsWith("/") ? `${origin}*` : `${origin}/*`;
}

const manifest = {
  manifest_version: 3,
  name: "SuperTunnel",
  version: "0.1.0",
  description: "VPN proxy controller for SuperTunnel.",
  action: {
    default_popup: "extension/popup.html",
    default_title: "SuperTunnel",
  },
  background: {
    service_worker: "extension/background.ts",
    type: "module" as const,
  },
  permissions: ["proxy", "storage", "alarms"],
  host_permissions: [withSlashStar(apiOrigin)],
  content_scripts: [
    {
      matches: ["http://localhost:9002/*"],
      js: ["extension/content.ts"],
      run_at: "document_idle" as const,
    },
  ],
  icons: {
    16: "extension/icons/16.png",
    32: "extension/icons/32.png",
    48: "extension/icons/48.png",
    128: "extension/icons/128.png",
  },
};

export default manifest;
