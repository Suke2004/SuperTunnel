/*
Background service worker for SuperTunnel.
Handles connect/disconnect state, persists to storage, and exposes messaging.
Logs all events to chrome.storage.session so the popup and dashboard stay in sync.
*/

import { DEFAULT_API_ORIGIN } from "./constants";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type LogLevel = "info" | "success" | "warn" | "error" | "system";

interface StoredState {
  state: ConnectionState;
  lastError?: string;
  endpoint?: string;
  localMode?: boolean;
  localProxyHost?: string;
  localProxyPort?: number;
  localProxyScheme?: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  level: LogLevel;
}

const STATE_DEFAULTS: StoredState = {
  state: "disconnected",
  lastError: undefined,
  endpoint: DEFAULT_API_ORIGIN,
  localMode: false,
  localProxyHost: undefined,
  localProxyPort: undefined,
  localProxyScheme: "http",
};

const LOGS_KEY = "_st_logs";
let logCounter = 0;

// ── Storage helpers ────────────────────────────────────────────────────

const readState = async (): Promise<StoredState> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      resolve({ ...STATE_DEFAULTS, ...items } as StoredState);
    });
  });
};

const writeState = async (partial: Partial<StoredState>) => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) cleaned[key] = value;
  }
  if (Object.keys(cleaned).length > 0) {
    await chrome.storage.local.set(cleaned);
  }
};

const readToken = async (): Promise<string | undefined> => {
  try {
    if (!chrome.storage.session) return undefined;
    return new Promise((resolve) => {
      chrome.storage.session.get({ token: undefined }, (items) => {
        if (chrome.runtime.lastError) { resolve(undefined); return; }
        resolve(items.token as string | undefined);
      });
    });
  } catch { return undefined; }
};

const writeToken = async (token: string | undefined) => {
  try {
    if (!chrome.storage.session) { await chrome.storage.local.set({ _token: token }); return; }
    await chrome.storage.session.set({ token });
  } catch { await chrome.storage.local.set({ _token: token }); }
};

// ── Centralized logging (chrome.storage.session) ───────────────────────

/** Append a log entry to the session-scoped log buffer. */
const addLog = async (message: string, level: LogLevel = "info") => {
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    + "." + now.getMilliseconds().toString().padStart(3, "0");
  logCounter += 1;
  const entry: LogEntry = { id: logCounter, timestamp, message, level };

  try {
    if (!chrome.storage.session) return;
    const result = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.session.get({ [LOGS_KEY]: [] }, (items) => resolve(items));
    });
    const existing = Array.isArray(result[LOGS_KEY]) ? (result[LOGS_KEY] as LogEntry[]) : [];
    const updated = [entry, ...existing].slice(0, 200);
    await chrome.storage.session.set({ [LOGS_KEY]: updated });
  } catch { /* ignore */ }
};

/** Read all logs from session storage. */
const readLogs = async (): Promise<LogEntry[]> => {
  try {
    if (!chrome.storage.session) return [];
    return new Promise((resolve) => {
      chrome.storage.session.get({ [LOGS_KEY]: [] }, (items) => {
        resolve(Array.isArray(items[LOGS_KEY]) ? items[LOGS_KEY] as LogEntry[] : []);
      });
    });
  } catch { return []; }
};

/** Clear all logs from session storage. */
const clearLogs = async () => {
  try {
    if (chrome.storage.session) await chrome.storage.session.set({ [LOGS_KEY]: [] });
  } catch { /* ignore */ }
};

// ── Badge ──────────────────────────────────────────────────────────────

const setBadge = async (state: ConnectionState) => {
  let text = "";
  let color = "#9ca3af";
  if (state === "connected") { text = "ON"; color = "#22c55e"; }
  else if (state === "connecting") { text = "..."; color = "#f59e0b"; }
  else if (state === "error") { text = "X"; color = "#ef4444"; }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
};

// ── Proxy control ──────────────────────────────────────────────────────

async function applyProxy(config: chrome.proxy.ProxyConfig): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function connectProxy(): Promise<void> {
  await writeState({ state: "connecting", lastError: undefined });
  await setBadge("connecting");
  try {
    const { endpoint, localMode, localProxyHost, localProxyPort, localProxyScheme } = await readState();

    if (localMode) {
      if (!localProxyHost || typeof localProxyPort !== "number") {
        throw new Error("Local proxy mode requires a valid host and port");
      }
      const scheme = localProxyScheme === "https" ? "https" : "http";
      await addLog(`Resolving ${localProxyHost}:${localProxyPort}...`, "info");
      await addLog(`TCP handshake with ${localProxyHost}:${localProxyPort}`, "info");
      await applyProxy({
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme, host: localProxyHost, port: localProxyPort },
          bypassList: ["<local>"],
        },
      });
      await addLog(`Proxy applied: ${scheme}://${localProxyHost}:${localProxyPort}`, "success");
      await addLog("All traffic is now routed through the local proxy", "success");
      await writeState({ state: "connected" });
      await setBadge("connected");
      return;
    }

    // Remote API mode
    const token = await readToken();
    const apiBase = (endpoint ?? DEFAULT_API_ORIGIN).replace(/\/$/, '');
    await addLog(`Connecting to API: ${apiBase}/connect`, "info");
    const resp = await fetch(`${apiBase}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ client: "extension" }),
    });

    if (!resp.ok) throw new Error(`connect failed: ${resp.status}`);

    const data: Record<string, unknown> = await resp.json().catch(() => ({}));

    if (data?.pacUrl) {
      await applyProxy({ mode: "pac_script", pacScript: { url: String(data.pacUrl) } });
      await addLog(`PAC proxy applied: ${data.pacUrl}`, "success");
    } else if (
      typeof (data?.proxy as Record<string, unknown>)?.host === "string" &&
      typeof (data?.proxy as Record<string, unknown>)?.port === "number"
    ) {
      const proxy = data.proxy as { host: string; port: number; scheme?: string };
      await applyProxy({
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme: proxy.scheme || "http", host: proxy.host, port: proxy.port },
          bypassList: Array.isArray(data?.bypassList) ? data.bypassList as string[] : ["<local>"],
        },
      });
      await addLog(`API proxy applied: ${proxy.host}:${proxy.port}`, "success");
    } else {
      throw new Error("invalid connect response: expected pacUrl or proxy");
    }

    await addLog("Tunnel established - traffic is encrypted", "success");
    await writeState({ state: "connected" });
    await setBadge("connected");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await addLog(`Connection failed: ${message}`, "error");
    await writeState({ state: "error", lastError: message });
    await setBadge("error");
  }
}

async function disconnectProxy(): Promise<void> {
  await addLog("Initiating disconnect...", "warn");
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.proxy.settings.clear({ scope: "regular" }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
    await addLog("Proxy settings cleared", "info");
  } catch (err) {
    await addLog(`Disconnect warning: ${err}`, "warn");
  } finally {
    await addLog("Session ended - connection terminated", "warn");
    await writeState({ state: "disconnected" });
    await setBadge("disconnected");
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await writeState({ state: "disconnected", endpoint: DEFAULT_API_ORIGIN });
  await setBadge("disconnected");
  await addLog("SuperTunnel extension installed", "system");
});

// ── Message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const handle = async () => {
    if (request?.type === "get_state") {
      const state = await readState();
      const token = await readToken();
      return { ...state, hasToken: Boolean(token) };
    }
    if (request?.type === "get_logs") {
      return { logs: await readLogs() };
    }
    if (request?.type === "clear_logs") {
      await clearLogs();
      await addLog("Log buffer cleared", "system");
      return { ok: true };
    }
    if (request?.type === "add_log") {
      await addLog(request.message ?? "", request.level ?? "info");
      return { ok: true };
    }
    if (request?.type === "set_token") {
      await writeToken(request.token ?? undefined);
      return { ok: true };
    }
    if (request?.type === "set_endpoint") {
      await writeState({ endpoint: request.endpoint ?? DEFAULT_API_ORIGIN });
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
      await addLog("Connect requested", "system");
      await connectProxy();
      return await readState();
    }
    if (request?.type === "disconnect") {
      await disconnectProxy();
      return await readState();
    }
    return { error: "unknown_request" };
  };

  handle().then((res) => sendResponse(res));
  return true;
});
