/*
Minimal background service worker for SuperTunnel.
Handles connect/disconnect state, persists to storage, and exposes basic messaging.
Replace API endpoints and proxy config as needed.
*/

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface StoredState {
  state: ConnectionState;
  lastError?: string;
  token?: string;
  endpoint?: string;
  localMode?: boolean;
  localProxyHost?: string;
  localProxyPort?: number;
  localProxyScheme?: string; // "http" | "https"
}

const DEFAULT_ENDPOINT = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_ORIGIN) || "https://api.supertunnel.example";

const readState = async (): Promise<StoredState> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { state: "disconnected", endpoint: DEFAULT_ENDPOINT, localMode: false, localProxyScheme: "http" },
      (items) => resolve(items as StoredState)
    );
  });
};

const writeState = async (partial: Partial<StoredState>) => {
  const current = await readState();
  await chrome.storage.local.set({ ...current, ...partial });
};

const setBadge = async (state: ConnectionState) => {
  let text = "";
  let color = "#9ca3af"; // gray
  if (state === "connected") {
    text = "ON";
    color = "#22c55e"; // green
  } else if (state === "connecting") {
    text = "...";
    color = "#f59e0b"; // amber
  } else if (state === "error") {
    text = "X";
    color = "#ef4444"; // red
  }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
};

async function connectProxy(): Promise<void> {
  await writeState({ state: "connecting", lastError: undefined });
  await setBadge("connecting");
  try {
    const { endpoint, token, localMode, localProxyHost, localProxyPort, localProxyScheme } = await readState();

    // Local fixed proxy mode
    if (localMode && localProxyHost && typeof localProxyPort === "number") {
      const scheme = localProxyScheme === "https" ? "https" : "http";
      const proxyConfig: chrome.proxy.ProxyConfig = {
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme, host: String(localProxyHost), port: Number(localProxyPort) },
          bypassList: ["<local>"],
        },
      } as any;
      await new Promise<void>((resolve) => {
        chrome.proxy.settings.set({ value: proxyConfig, scope: "regular" }, () => resolve());
      });
      await writeState({ state: "connected" });
      await setBadge("connected");
      return;
    }

    // Remote API-driven mode
    const resp = await fetch(`${endpoint.replace(/\/$/, '')}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ client: "extension" }),
    });

    if (!resp.ok) {
      throw new Error(`connect failed: ${resp.status}`);
    }

    // Expect API to return either { pacUrl } or { proxy: { host, port, scheme } }
    const data = await resp.json().catch(() => ({} as any));
    let proxyConfig: chrome.proxy.ProxyConfig;

    if (data?.pacUrl) {
      proxyConfig = { mode: "pac_script", pacScript: { url: String(data.pacUrl) } } as any;
    } else if (data?.proxy?.host && data?.proxy?.port) {
      proxyConfig = {
        mode: "fixed_servers",
        rules: {
          singleProxy: {
            scheme: data?.proxy?.scheme || "http",
            host: String(data.proxy.host),
            port: Number(data.proxy.port),
          },
          bypassList: Array.isArray(data?.bypassList) ? data.bypassList : ["<local>"],
        },
      };
    } else {
      throw new Error("invalid connect response: expected pacUrl or proxy");
    }

    await new Promise<void>((resolve) => {
      chrome.proxy.settings.set({ value: proxyConfig, scope: "regular" }, () => resolve());
    });

    await writeState({ state: "connected" });
    await setBadge("connected");
  } catch (err: any) {
    await writeState({ state: "error", lastError: String(err?.message || err) });
    await setBadge("error");
  }
}

async function disconnectProxy(): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      chrome.proxy.settings.clear({ scope: "regular" }, () => resolve());
    });
  } finally {
    await writeState({ state: "disconnected" });
    await setBadge("disconnected");
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await writeState({ state: "disconnected", endpoint: DEFAULT_ENDPOINT });
  await setBadge("disconnected");
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const handle = async () => {
    if (request?.type === "get_state") {
      const state = await readState();
      return state;
    }
    if (request?.type === "set_token") {
      await writeState({ token: request.token ?? undefined });
      return { ok: true };
    }
    if (request?.type === "set_endpoint") {
      await writeState({ endpoint: request.endpoint ?? DEFAULT_ENDPOINT });
      return { ok: true };
    }
    if (request?.type === "set_local_mode") {
      await writeState({ localMode: Boolean(request.enabled) });
      return { ok: true };
    }
    if (request?.type === "set_local_proxy") {
      const host = typeof request.host === "string" ? request.host.trim() : undefined;
      const port = Number(request.port);
      const scheme = request.scheme === "https" ? "https" : "http";
      await writeState({ localProxyHost: host, localProxyPort: isFinite(port) ? port : undefined, localProxyScheme: scheme });
      return { ok: true };
    }
    if (request?.type === "connect") {
      await connectProxy();
      const state = await readState();
      return state;
    }
    if (request?.type === "disconnect") {
      await disconnectProxy();
      const state = await readState();
      return state;
    }
    return { error: "unknown_request" };
  };

  handle().then((res) => sendResponse(res));
  return true; // keep channel open for async response
});


