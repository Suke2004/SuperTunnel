"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRightLeft, Clock, Globe, Loader2, Power, ShieldCheck, ShieldOff,
  Sparkles, Activity, Trash2, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type LogLevel = "info" | "success" | "warn" | "error" | "system";

interface LogEntry { id: number; timestamp: string; message: string; level: LogLevel; }

const LOG_STYLES: Record<LogLevel, { dot: string; text: string; label: string }> = {
  info:    { dot: "bg-blue-400",    text: "text-muted-foreground", label: "INFO" },
  success: { dot: "bg-emerald-400", text: "text-emerald-400",     label: "OK" },
  warn:    { dot: "bg-amber-400",   text: "text-amber-400",       label: "WARN" },
  error:   { dot: "bg-red-400",     text: "text-red-400",         label: "ERR" },
  system:  { dot: "bg-violet-400",  text: "text-violet-400",      label: "SYS" },
};

const LOGS_KEY = "_st_dashboard_logs";

const SOURCE_PAGE = "supertunnel-dashboard";
const SOURCE_EXT = "supertunnel-extension";

/** Send a message to the extension background via the content script bridge. */
function bgMsg(msg: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, 1500);
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== SOURCE_EXT || event.data?.id !== id) return;
      cleanup();
      resolve(event.data.response ?? null);
    };
    const cleanup = () => { clearTimeout(timeout); window.removeEventListener("message", handler); };
    window.addEventListener("message", handler);
    window.postMessage({ source: SOURCE_PAGE, id, payload: msg }, "*");
  });
}

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [localMode, setLocalMode] = useState(false);
  const [localHost, setLocalHost] = useState("127.0.0.1");
  const [localPort, setLocalPort] = useState("8080");
  const [localScheme, setLocalScheme] = useState<"http" | "https">("http");
  const [endpoint, setEndpoint] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptime, setUptime] = useState(0);
  const [data, setData] = useState({ down: 0, up: 0 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const logIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ── Local log helpers (sessionStorage fallback) ──────────────────────

  const persistLogs = useCallback((entries: LogEntry[]) => {
    try { sessionStorage.setItem(LOGS_KEY, JSON.stringify(entries)); } catch {}
  }, []);

  const addLocalLog = useCallback((message: string, level: LogLevel = "info") => {
    const now = new Date();
    const ts = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      + "." + now.getMilliseconds().toString().padStart(3, "0");
    logIdRef.current += 1;
    setLogs((prev) => {
      const next = [{ id: logIdRef.current, timestamp: ts, message, level }, ...prev].slice(0, 100);
      persistLogs(next);
      return next;
    });
  }, [persistLogs]);

  // ── Sync with extension ──────────────────────────────────────────────

  const syncFromExtension = useCallback(async () => {
    const stateRes = await bgMsg({ type: "get_state" });
    if (!stateRes) return false;
    setExtensionAvailable(true);
    setStatus((stateRes.state as ConnectionStatus) || "disconnected");
    setLocalMode(Boolean(stateRes.localMode));
    if (stateRes.localProxyHost) setLocalHost(stateRes.localProxyHost as string);
    if (stateRes.localProxyPort) setLocalPort(String(stateRes.localProxyPort));
    if (stateRes.localProxyScheme) setLocalScheme(stateRes.localProxyScheme as "http" | "https");
    if (stateRes.endpoint) setEndpoint(stateRes.endpoint as string);

    const logRes = await bgMsg({ type: "get_logs" });
    if (logRes && Array.isArray(logRes.logs)) {
      setLogs(logRes.logs as LogEntry[]);
    }
    return true;
  }, []);

  // Initial load: try extension first, fallback to sessionStorage
  useEffect(() => {
    syncFromExtension().then((synced) => {
      if (!synced) {
        try {
          const stored = sessionStorage.getItem(LOGS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as LogEntry[];
            if (parsed.length > 0) {
              logIdRef.current = parsed.reduce((m, e) => Math.max(m, e.id), 0);
              setLogs(parsed);
              return;
            }
          }
        } catch {}
        addLocalLog("SuperTunnel dashboard initialized", "system");
        addLocalLog("Extension not detected - running in standalone mode", "warn");
      }
    });
  }, [syncFromExtension, addLocalLog]);

  // Poll extension for updates every 2s
  useEffect(() => {
    if (!extensionAvailable) return;
    pollRef.current = setInterval(syncFromExtension, 2000);
    return () => clearInterval(pollRef.current);
  }, [extensionAvailable, syncFromExtension]);

  // Uptime + data transfer
  useEffect(() => {
    let ui: ReturnType<typeof setInterval>, di: ReturnType<typeof setInterval>;
    if (status === "connected") {
      setUptime(0); setData({ down: 0, up: 0 });
      ui = setInterval(() => setUptime((s) => s + 1), 1000);
      di = setInterval(() => setData((d) => ({ down: d.down + Math.random() * 1.5, up: d.up + Math.random() * 0.5 })), 1500);
    }
    return () => { clearInterval(ui); clearInterval(di); };
  }, [status]);

  const formatUptime = (t: number) => {
    const h = Math.floor(t / 3600).toString().padStart(2, "0");
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, "0");
    const s = (t % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // ── Actions ──────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (extensionAvailable) {
      await bgMsg({ type: "set_local_mode", enabled: localMode });
      await bgMsg({ type: "set_local_proxy", host: localHost, port: localPort ? Number(localPort) : undefined, scheme: localScheme });
      if (endpoint) await bgMsg({ type: "set_endpoint", endpoint });
      await bgMsg({ type: "connect" });
      await syncFromExtension();
    } else {
      setStatus("connecting");
      addLocalLog(`Connecting to ${localScheme}://${localHost}:${localPort}...`, "info");
      setTimeout(() => {
        addLocalLog("Extension required for actual proxy control", "warn");
        addLocalLog("Install the SuperTunnel extension and reload this page", "error");
        setStatus("disconnected");
      }, 1500);
    }
  };

  const handleDisconnect = async () => {
    if (extensionAvailable) {
      await bgMsg({ type: "disconnect" });
      await syncFromExtension();
    } else {
      setStatus("disconnected");
      addLocalLog("Disconnected", "warn");
    }
    setUptime(0); setData({ down: 0, up: 0 });
  };

  const handleClearLogs = async () => {
    if (extensionAvailable) {
      await bgMsg({ type: "clear_logs" });
      await syncFromExtension();
    } else {
      setLogs([]);
      sessionStorage.removeItem(LOGS_KEY);
      addLocalLog("Log buffer cleared", "system");
    }
  };

  const handleAnalyzeLogs = async () => {
    setIsAnalyzing(true); setAnalysis(null); setAnalyzeError(null);
    if (extensionAvailable) await bgMsg({ type: "add_log", message: "AI analysis started from dashboard", level: "system" });
    else addLocalLog("AI analysis started...", "system");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Failed (${res.status})`);
      setAnalysis(result.analysis);
      if (extensionAvailable) await bgMsg({ type: "add_log", message: "AI analysis complete", level: "success" });
      else addLocalLog("AI analysis complete", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setAnalyzeError(msg);
      if (extensionAvailable) await bgMsg({ type: "add_log", message: `AI error: ${msg}`, level: "error" });
      else addLocalLog(`AI error: ${msg}`, "error");
    } finally {
      setIsAnalyzing(false);
      if (extensionAvailable) await syncFromExtension();
    }
  };

  const si = (() => {
    switch (status) {
      case "connected": return { text: "Connected", color: "text-green-500", glow: "shadow-green-500/20", icon: <ShieldCheck className="h-8 w-8 text-green-500" />, btn: "Disconnect", variant: "destructive" as const };
      case "connecting": return { text: "Connecting...", color: "text-yellow-500", glow: "shadow-yellow-500/20", icon: <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />, btn: "Connecting", variant: "secondary" as const };
      case "error": return { text: "Error", color: "text-red-500", glow: "shadow-red-500/20", icon: <ShieldOff className="h-8 w-8 text-red-500" />, btn: "Retry", variant: "default" as const };
      default: return { text: "Disconnected", color: "text-red-500", glow: "shadow-red-500/20", icon: <ShieldOff className="h-8 w-8 text-red-500" />, btn: "Connect", variant: "default" as const };
    }
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icons.logo className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold">SuperTunnel</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Dashboard</span>
            {extensionAvailable && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Extension Synced</span>}
          </div>
          <div className="flex items-center gap-2">
            {si.icon}
            <span className={`text-sm font-semibold ${si.color}`}>{si.text}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Status + Connect */}
            <Card className={`shadow-xl transition-all duration-500 border-none bg-card/60 backdrop-blur-xl relative overflow-hidden ${si.glow}`}>
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${si.color.split('-')[1]}-500 to-transparent opacity-50`} />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5" />Connection</CardTitle>
                <CardDescription>Manage your VPN tunnel</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 py-6">
                <div className="relative group">
                  <div className={`absolute inset-0 blur-3xl rounded-full opacity-20 transition-all duration-700 ${si.color} bg-current group-hover:opacity-40 animate-pulse`} />
                  <div className="relative transform transition-transform duration-500 hover:scale-110">
                    {si.icon}
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <span className={`text-3xl font-black tracking-tighter ${si.color} transition-colors duration-500`}>{si.text}</span>
                  {status === "connected" && <p className="text-[10px] font-mono text-muted-foreground animate-pulse tracking-widest">TUNNEL ACTIVE via {localMode ? 'LOCAL' : 'REMOTE'}</p>}
                </div>
                <Button size="lg" variant={si.variant} className="h-14 w-full text-base font-bold shadow-lg active:scale-95 transition-all"
                  onClick={status === "connected" ? handleDisconnect : handleConnect}
                  disabled={status === "connecting"}>
                  <Power className="h-5 w-5 mr-2" />{si.btn}
                </Button>
              </CardContent>
            </Card>

            {/* Proxy Settings */}
            <Card className="border-none bg-card/40 backdrop-blur-md shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Proxy Settings</CardTitle>
                <CardDescription>Configure connection mode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="localMode" className="font-bold">Local Proxy</Label>
                    <p className="text-[10px] text-muted-foreground">Bypass API for local bridge</p>
                  </div>
                  <Switch id="localMode" checked={localMode} 
                    onCheckedChange={async (v) => {
                      setLocalMode(v);
                      if (extensionAvailable) await bgMsg({ type: "set_local_mode", enabled: v });
                    }} 
                    disabled={status !== "disconnected"} />
                </div>
                {localMode ? (
                  <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                      <Label htmlFor="host" className="text-xs font-bold uppercase text-muted-foreground">Host</Label>
                      <Input id="host" value={localHost} 
                        onChange={async (e) => {
                          const val = e.target.value;
                          setLocalHost(val);
                          if (extensionAvailable) await bgMsg({ type: "set_local_proxy", host: val, port: localPort, scheme: localScheme });
                        }} 
                        placeholder="127.0.0.1" disabled={status !== "disconnected"} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="port" className="text-xs font-bold uppercase text-muted-foreground">Port</Label>
                        <Input id="port" type="number" value={localPort} 
                          onChange={async (e) => {
                            const val = e.target.value;
                            setLocalPort(val);
                            if (extensionAvailable) await bgMsg({ type: "set_local_proxy", host: localHost, port: val, scheme: localScheme });
                          }} 
                          placeholder="8080" disabled={status !== "disconnected"} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="scheme" className="text-xs font-bold uppercase text-muted-foreground">Scheme</Label>
                        <Select value={localScheme} 
                          onValueChange={async (v) => {
                            setLocalScheme(v as "http" | "https");
                            if (extensionAvailable) await bgMsg({ type: "set_local_proxy", host: localHost, port: localPort, scheme: v });
                          }} 
                          disabled={status !== "disconnected"}>
                          <SelectTrigger id="scheme" className="font-medium"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="https">HTTPS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="ep" className="text-xs font-bold uppercase text-muted-foreground">API Endpoint</Label>
                    <Input id="ep" value={endpoint} 
                      onChange={async (e) => {
                        const val = e.target.value;
                        setEndpoint(val);
                        if (extensionAvailable) await bgMsg({ type: "set_endpoint", endpoint: val });
                      }} 
                      placeholder="https://api.supertunnel.example" disabled={status !== "disconnected"} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Stats */}
            <Card className="border-none bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/10">
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Live Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-px bg-border/20 p-0">
                <div className="bg-card p-4 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
                    <Clock className="h-3 w-3" /> Duration
                  </p>
                  <p className="text-2xl font-black tracking-tight font-mono">{formatUptime(uptime)}</p>
                </div>
                <div className="bg-card p-4 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
                    <ArrowRightLeft className="h-3 w-3" /> Data Usage
                  </p>
                  <p className="text-2xl font-black tracking-tight font-mono text-emerald-500">{data.down.toFixed(1)}<span className="text-xs ml-0.5 opacity-70">MB</span></p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-[9px] font-bold text-muted-foreground">
                    <span className="flex items-center gap-1"><ArrowRightLeft className="h-2.5 w-2.5 text-emerald-500 animate-bounce" />{data.down.toFixed(1)}</span>
                    <span className="opacity-20">|</span>
                    <span className="flex items-center gap-1"><ArrowRightLeft className="h-2.5 w-2.5 text-blue-500 rotate-180" />{data.up.toFixed(1)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Activity Logs */}
            <Card className="flex flex-col flex-grow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Activity Logs</CardTitle>
                    <CardDescription>{logs.length} entries {extensionAvailable && "- synced with extension"}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearLogs} className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-0">
                <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/30">
                  <div className="p-3 space-y-0.5">
                    {logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No log entries yet.</p>
                    ) : logs.map((entry) => {
                      const st = LOG_STYLES[entry.level];
                      return (
                        <div key={entry.id} className="flex items-start gap-2 py-[3px] font-mono text-[11px] leading-relaxed group hover:bg-muted/50 rounded px-1.5 -mx-1.5 transition-colors">
                          <span className="text-muted-foreground/60 shrink-0 tabular-nums select-none">{entry.timestamp}</span>
                          <span className="flex items-center gap-1 shrink-0 w-[42px]">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            <span className={`text-[10px] font-semibold uppercase ${st.text} opacity-70`}>{st.label}</span>
                          </span>
                          <span className={`${entry.level === "error" ? "text-red-400" : entry.level === "success" ? "text-emerald-300/90" : entry.level === "warn" ? "text-amber-300/90" : entry.level === "system" ? "text-violet-300/90" : "text-foreground/80"} break-all`}>
                            {entry.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex-col items-start gap-3 pt-0">
                {analysis && (
                  <Alert className="w-full"><Sparkles className="h-4 w-4" /><AlertTitle className="text-sm font-semibold">AI Analysis</AlertTitle><AlertDescription className="text-sm">{analysis}</AlertDescription></Alert>
                )}
                {analyzeError && (
                  <Alert variant="destructive" className="w-full"><AlertTitle className="text-sm font-semibold">Analysis Error</AlertTitle><AlertDescription className="text-sm">{analyzeError}</AlertDescription></Alert>
                )}
                <Button onClick={handleAnalyzeLogs} disabled={isAnalyzing || logs.length === 0} className="w-full h-10">
                  {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isAnalyzing ? "Analyzing..." : "Analyze Logs with AI"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
