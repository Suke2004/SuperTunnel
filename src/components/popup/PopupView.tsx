"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Clock, ArrowRightLeft, Loader2, Power, ShieldCheck, ShieldOff, Trash2, Sparkles, Settings2 } from "lucide-react";
import { Icons } from "@/components/icons";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type LogLevel = "info" | "success" | "warn" | "error" | "system";

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  level: LogLevel;
}

const LOG_STYLES: Record<LogLevel, { dot: string; text: string }> = {
  info:    { dot: "bg-blue-400",    text: "text-foreground/60" },
  success: { dot: "bg-emerald-400", text: "text-emerald-400" },
  warn:    { dot: "bg-amber-400",   text: "text-amber-400" },
  error:   { dot: "bg-red-400",     text: "text-red-400" },
  system:  { dot: "bg-violet-400",  text: "text-violet-400" },
};

const bg = (msg: Record<string, unknown>) =>
  chrome.runtime.sendMessage(msg) as Promise<Record<string, unknown>>;

export default function PopupView() {
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const [localHost, setLocalHost] = useState("");
  const [localPort, setLocalPort] = useState("");
  const [localScheme, setLocalScheme] = useState<"http" | "https">("http");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptime, setUptime] = useState(0);
  const [data, setData] = useState({ down: 0, up: 0 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "settings" | "logs">("status");
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      const s = await bg({ type: "get_state" });
      setStatus((s?.state as ConnectionState) || "disconnected");
      setEndpoint((s?.endpoint as string) || "");
      setLocalMode(Boolean(s?.localMode));
      setLocalHost((s?.localProxyHost as string) || "");
      setLocalPort(s?.localProxyPort != null ? String(s.localProxyPort) : "");
      setLocalScheme(s?.localProxyScheme === "https" ? "https" : "http");

      const logRes = await bg({ type: "get_logs" });
      if (Array.isArray(logRes?.logs)) setLogs(logRes.logs as LogEntry[]);
    } catch { /* ignored */ }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 2000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

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

  const onConnectToggle = async () => {
    if (status === "connected") await bg({ type: "disconnect" });
    else {
      await bg({ type: "set_endpoint", endpoint });
      await bg({ type: "set_token", token });
      await bg({ type: "set_local_mode", enabled: localMode });
      await bg({ type: "set_local_proxy", host: localHost, port: localPort ? Number(localPort) : undefined, scheme: localScheme });
      await bg({ type: "connect" });
    }
    await refresh();
  };

  const si = useMemo(() => {
    switch (status) {
      case "connected": return { text: "Connected", color: "text-emerald-500", glow: "shadow-emerald-500/20", icon: <ShieldCheck className="h-6 w-6 text-emerald-500" />, variant: "destructive" as const, btn: "Disconnect" };
      case "connecting": return { text: "Connecting...", color: "text-amber-500", glow: "shadow-amber-500/20", icon: <Loader2 className="h-6 w-6 animate-spin text-amber-500" />, variant: "secondary" as const, btn: "Connecting" };
      case "error": return { text: "Error", color: "text-red-500", glow: "shadow-red-500/20", icon: <ShieldOff className="h-6 w-6 text-red-500" />, variant: "default" as const, btn: "Retry" };
      default: return { text: "Disconnected", color: "text-muted-foreground", glow: "shadow-none", icon: <ShieldOff className="h-6 w-6 text-muted-foreground" />, variant: "default" as const, btn: "Connect" };
    }
  }, [status]);

  const analyzeLogs = async () => {
    setIsAnalyzing(true); setAnalysis(null);
    await bg({ type: "add_log", message: "AI Analysis started...", level: "system" });
    try {
      const api = (endpoint || "").replace(/\/$/, "");
      if (!api) throw new Error("No API endpoint");
      const res = await fetch(`${api}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis);
      await bg({ type: "add_log", message: "AI Analysis complete", level: "success" });
    } catch (err: any) {
      setAnalysis(`Error: ${err.message}`);
      await bg({ type: "add_log", message: `AI Error: ${err.message}`, level: "error" });
    } finally {
      setIsAnalyzing(false);
      await refresh();
    }
  };

  return (
    <div className="w-[360px] min-h-[500px] bg-background text-foreground flex flex-col antialiased">
      {/* Header */}
      <header className="p-4 border-b flex items-center justify-between bg-card/30 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Icons.logo className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight uppercase">SuperTunnel</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold ${si.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-current animate-pulse`} />
          {si.text.toUpperCase()}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 space-y-4">
        {/* Navigation */}
        <div className="flex p-1 bg-muted rounded-lg gap-1">
          {(["status", "settings", "logs"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === "status" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className={`overflow-hidden border-none bg-card/50 shadow-lg ${si.glow}`}>
              <CardContent className="p-6 flex flex-col items-center gap-6">
                <div className="relative">
                   <div className={`absolute inset-0 blur-2xl rounded-full opacity-20 ${si.color} bg-current`} />
                   {si.icon}
                </div>
                <div className="text-center space-y-1">
                  <h2 className={`text-xl font-bold ${si.color}`}>{si.text}</h2>
                  <p className="text-[10px] text-muted-foreground font-mono">{endpoint || "Standby Mode"}</p>
                </div>
                <Button size="lg" variant={si.variant} onClick={onConnectToggle} disabled={status === "connecting"}
                  className="w-full h-12 text-sm font-bold shadow-md active:scale-[0.98] transition-transform">
                  <Power className="h-4 w-4 mr-2" />{si.btn}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-card/40 rounded-xl border border-border/50">
                <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1.5 mb-1.5">
                  <Clock className="h-3 w-3" /> Uptime
                </Label>
                <p className="text-sm font-mono font-bold">{formatUptime(uptime)}</p>
              </div>
              <div className="p-3 bg-card/40 rounded-xl border border-border/50">
                <Label className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1.5 mb-1.5">
                  <ArrowRightLeft className="h-3 w-3" /> Traffic
                </Label>
                <p className="text-[11px] font-mono font-bold leading-none">
                  <span className="text-emerald-400">{data.down.toFixed(1)}M↓</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-blue-400">{data.up.toFixed(1)}M↑</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="space-y-3 p-1">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">API Endpoint</Label>
                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://..." className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Auth Token</Label>
                <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••" className="h-9 text-xs" />
              </div>
              <div className="flex items-center justify-between py-2 border-y border-border/30">
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase font-bold">Local Proxy</Label>
                  <p className="text-[9px] text-muted-foreground">Use mitmproxy or local bridge</p>
                </div>
                <Switch checked={localMode} onCheckedChange={setLocalMode} />
              </div>
              {localMode && (
                <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Host</Label>
                    <Input value={localHost} onChange={(e) => setLocalHost(e.target.value)} placeholder="127.0.0.1" className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Port</Label>
                    <Input type="number" value={localPort} onChange={(e) => setLocalPort(e.target.value)} placeholder="8080" className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Scheme</Label>
                    <Select value={localScheme} onValueChange={(v: any) => setLocalScheme(v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="flex flex-col h-[340px] animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{logs.length} Log Entries</span>
              <Button variant="ghost" size="sm" onClick={() => bg({ type: "clear_logs" }).then(refresh)} className="h-6 px-2 text-[9px] uppercase font-bold hover:text-red-400">
                <Trash2 className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
            <ScrollArea className="flex-grow border rounded-xl bg-card/30 p-2 font-mono">
              <div className="space-y-1">
                {logs.length === 0 ? (
                  <p className="text-[9px] text-center text-muted-foreground py-10 italic">Log buffer is empty.</p>
                ) : logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-1.5 text-[9px] leading-tight">
                    <span className="text-muted-foreground/40 shrink-0 select-none">{l.timestamp.split('.')[0]}</span>
                    <span className={`h-1.5 w-1.5 rounded-full mt-1 shrink-0 ${LOG_STYLES[l.level].dot}`} />
                    <span className={`${LOG_STYLES[l.level].text} break-all`}>{l.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-3 pt-3 border-t">
               {analysis && (
                 <div className="mb-3 p-2 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in zoom-in-95 duration-300">
                    <p className="text-[10px] font-bold text-primary flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-3 w-3" /> AI ANALYSIS
                    </p>
                    <p className="text-[10px] leading-snug">{analysis}</p>
                 </div>
               )}
               <Button size="sm" onClick={analyzeLogs} disabled={isAnalyzing || logs.length === 0}
                 className="w-full h-9 text-[10px] font-bold uppercase tracking-wider">
                 {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                 {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
               </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-3 border-t bg-card/20 flex items-center justify-between">
         <span className="text-[9px] text-muted-foreground font-bold opacity-50 underline decoration-dotted cursor-help">v0.1.0-BETA</span>
         <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <div className="w-1.5 h-1.5 rounded-full bg-muted" />
         </div>
      </footer>
    </div>
  );
}
