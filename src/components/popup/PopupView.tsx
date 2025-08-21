"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, Clock, ArrowRightLeft, Loader2, Power, ShieldCheck, ShieldOff } from "lucide-react";
import { Icons } from "@/components/icons";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export default function PopupView() {
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const [localHost, setLocalHost] = useState("");
  const [localPort, setLocalPort] = useState("");
  const [localScheme, setLocalScheme] = useState<"http" | "https">("http");
  const [logs, setLogs] = useState<string[]>(["Welcome to SuperTunnel."]);
  const [uptime, setUptime] = useState(0);
  const [data, setData] = useState({ down: 0, up: 0 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const refresh = async () => {
    const s = await chrome.runtime.sendMessage({ type: "get_state" });
    setStatus(s?.state || "disconnected");
    setEndpoint(s?.endpoint || "");
    setLocalMode(Boolean(s?.localMode));
    setLocalHost(s?.localProxyHost || "");
    setLocalPort(s?.localProxyPort != null ? String(s.localProxyPort) : "");
    setLocalScheme(s?.localProxyScheme === "https" ? "https" : "http");
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    let uptimeInterval: any;
    let dataInterval: any;
    if (status === "connected") {
      setUptime(0);
      setData({ down: 0, up: 0 });
      uptimeInterval = setInterval(() => setUptime((s) => s + 1), 1000);
      dataInterval = setInterval(() => {
        setData((d) => ({ down: d.down + Math.random() * 1.5, up: d.up + Math.random() * 0.5 }));
      }, 1500);
    }
    return () => {
      clearInterval(uptimeInterval);
      clearInterval(dataInterval);
    };
  }, [status]);

  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const onConnectToggle = async () => {
    if (status === "connected") {
      await chrome.runtime.sendMessage({ type: "disconnect" });
      addLog("Connection terminated.");
    } else if (status === "disconnected" || status === "error") {
      if (endpoint) await chrome.runtime.sendMessage({ type: "set_endpoint", endpoint });
      if (token) await chrome.runtime.sendMessage({ type: "set_token", token });
      await chrome.runtime.sendMessage({ type: "set_local_mode", enabled: localMode });
      await chrome.runtime.sendMessage({ type: "set_local_proxy", host: localHost, port: localPort ? Number(localPort) : undefined, scheme: localScheme });
      await chrome.runtime.sendMessage({ type: "connect" });
      addLog(localMode ? "Connecting via local proxy..." : "Connecting via API...");
    }
    await refresh();
  };

  const getStatusInfo = useMemo(() => {
    switch (status) {
      case "connected":
        return { text: "Connected", color: "text-green-500", icon: <ShieldCheck className="h-5 w-5 text-green-500" />, variant: "destructive" as const, button: "Disconnect" };
      case "connecting":
        return { text: "Connecting...", color: "text-yellow-500", icon: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />, variant: "secondary" as const, button: "Connecting" };
      case "error":
        return { text: "Error", color: "text-red-500", icon: <ShieldOff className="h-5 w-5 text-red-500" />, variant: "default" as const, button: "Retry" };
      default:
        return { text: "Disconnected", color: "text-red-500", icon: <ShieldOff className="h-5 w-5 text-red-500" />, variant: "default" as const, button: "Connect" };
    }
  }, [status]);

  const analyzeLogs = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    addLog("AI analysis started...");
    setTimeout(() => {
      const mock = `Stable connection with low latency. If issues persist, switch scheme or server.`;
      setAnalysis(mock);
      addLog("AI analysis complete.");
      setIsAnalyzing(false);
    }, 1500);
  };

  return (
    <div className="w-full bg-background text-foreground flex flex-col items-center p-4">
      <header className="w-full flex items-center justify-center gap-2 pb-4">
        <Icons.logo className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">SuperTunnel</h1>
      </header>

      <main className="w-full flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              {getStatusInfo.icon}
              <span className={`text-lg font-semibold ${getStatusInfo.color}`}>{getStatusInfo.text}</span>
            </div>
            <Button
              size="lg"
              variant={getStatusInfo.variant}
              className="h-12 w-full text-base"
              onClick={onConnectToggle}
              disabled={status === "connecting"}
            >
              <Power className="h-5 w-5 mr-2" />
              <span>{getStatusInfo.button}</span>
            </Button>
            <div className="w-full grid grid-cols-2 gap-2 text-center">
              <div className="bg-muted p-2 rounded-md">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatUptime(uptime)}
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md">
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-semibold flex items-center justify-center gap-1">
                  <ArrowRightLeft className="h-4 w-4" />
                  {`${data.down.toFixed(1)}MB↓/${data.up.toFixed(1)}MB↑`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="endpoint">API endpoint</Label>
              <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="token">Auth token (optional)</Label>
              <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="localMode">Use local proxy</Label>
              <Switch id="localMode" checked={localMode} onCheckedChange={(v) => setLocalMode(Boolean(v))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 col-span-2">
                <Label htmlFor="localHost">Local proxy host</Label>
                <Input id="localHost" value={localHost} onChange={(e) => setLocalHost(e.target.value)} placeholder="127.0.0.1" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="localPort">Port</Label>
                <Input id="localPort" type="number" value={localPort} onChange={(e) => setLocalPort(e.target.value)} placeholder="8080" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="localScheme">Scheme</Label>
                <select id="localScheme" className="border rounded h-9 px-2" value={localScheme} onChange={(e) => setLocalScheme(e.target.value as any)}>
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">Activity Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ScrollArea className="h-[120px] w-full rounded-md border p-2 font-mono text-xs">
              {logs.map((log, i) => (
                <p key={i} className="whitespace-pre-wrap leading-snug">{log}</p>
              ))}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 p-4 pt-0">
            {analysis && (
              <Alert className="p-2">
                <AlertTitle className="text-xs font-semibold mb-0.5">AI Analysis</AlertTitle>
                <AlertDescription className="text-xs">{analysis}</AlertDescription>
              </Alert>
            )}
            <Button onClick={analyzeLogs} disabled={isAnalyzing} className="w-full h-9 text-sm">
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
              Analyze Logs
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}


