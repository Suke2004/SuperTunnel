const apiOrigin = process.env.VITE_API_ORIGIN || "https://api.supertunnel.example";

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
  icons: {
    16: "extension/icons/16.png",
    32: "extension/icons/32.png",
    48: "extension/icons/48.png",
    128: "extension/icons/128.png",
  },
} as const;

export default manifest;


