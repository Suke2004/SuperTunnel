## SuperTunnel

SuperTunnel is an open-source, browser-based VPN controller. It ships with:

- **Web Extension (MV3)**: Background service worker, popup UI, and Vite+CRX build.
- **Next.js UI**: A modern React/Tailwind app scaffold for your server-side management UI.

The extension configures a browser proxy via the `proxy` API and talks to your server to fetch either a PAC script URL or fixed proxy settings. This keeps all traffic inside the browser, without requiring OS-level drivers.

### Features
- **One-click connect/disconnect** via popup
- **Dynamic proxy configuration** from your API: PAC or fixed proxy
- **Status badge** and basic persisted state in `chrome.storage`
- **Vite + CRX** build for a compact MV3 bundle

## Getting Started

### Prerequisites
- Node.js 20.18+ and pnpm
- Chrome/Chromium (MV3), optionally Firefox (MV3 support varies)

### Install dependencies
```bash
pnpm install
```

### Configure the API origin
The extension reads the API origin from `VITE_API_ORIGIN` at build-time.

Examples:
- PowerShell (Windows):
```powershell
$env:VITE_API_ORIGIN = 'https://api.example.com'
pnpm run build:extension
```

- .env file (Vite automatically loads):
```
VITE_API_ORIGIN=https://api.example.com
```

### Build the extension
```bash
# Optional: generate simple placeholder icons
pnpm run gen:icons

# Build the web extension
pnpm run build:extension
```

The bundle will be produced in `dist-extension/`.

### Load in Chrome
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click “Load unpacked” and select the `dist-extension` directory

### Run the Next.js app (optional)
```bash
pnpm run dev
```
Open `http://localhost:9002`.

## How it Works

- `extension/background.ts`
  - Persists connection state in `chrome.storage.local`
  - On “Connect”, posts to `POST {VITE_API_ORIGIN}/connect`
  - Expects a response with either:
    - `{ pacUrl: string }` OR
    - `{ proxy: { host: string; port: number; scheme?: 'http'|'https' }, bypassList?: string[] }`
  - Applies the proxy via `chrome.proxy.settings.set`

- `extension/popup.html` + `extension/popup.ts`
  - Simple UI to set endpoint/token and connect/disconnect
  - Sends messages to the background worker (`get_state`, `connect`, `disconnect`, `set_endpoint`, `set_token`)

- `extension/manifest.ts`
  - MV3 manifest generated at build time
  - Uses `VITE_API_ORIGIN` to populate `host_permissions`

## API Contract
```
POST {API_ORIGIN}/connect
Content-Type: application/json
Authorization: Bearer <token>      # optional
Body: { "client": "extension" }

200 OK
{ "pacUrl": "https://.../proxy.pac" }
  - or -
{ "proxy": { "host": "127.0.0.1", "port": 8080, "scheme": "http" }, "bypassList": ["<local>"] }
```
If your API differs, update `extension/background.ts` accordingly.

## Development
- `pnpm run dev:extension` – start Vite in watch mode for the extension
- `pnpm run build:extension` – build the MV3 extension
- `pnpm run gen:icons` – generate simple placeholder icons

## Browser Permissions
The MV3 manifest requests:
- `proxy`, `storage`, `alarms`
And `host_permissions` based on `VITE_API_ORIGIN`.

## Contributing
Contributions are welcome! Please:
- Open an issue to discuss substantial changes
- Submit a focused pull request with clear rationale
- Follow the existing code style and TypeScript conventions

By participating, you agree to uphold a respectful, inclusive environment. We recommend adopting the Contributor Covenant as a Code of Conduct.

## Security
If you discover a security issue, please report it privately first. Avoid filing public issues for sensitive vulnerabilities until a fix is available.

## License
MIT. See `LICENSE` for details.

## Authors
- Benny 01r <benny01r@gmail.com>
- Irshad Siddi <mohammadirshadsiddi@gmail.com>
- Sukesh Reddy Ustela <sukeshreddyustela@gmail.com>

