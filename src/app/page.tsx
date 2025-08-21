"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft,
  Clock,
  Globe,
  Loader2,
  Power,
  ShieldCheck,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const servers = [
  { value: "us-ny", label: "USA - New York", region: "North America" },
  { value: "de-fra", label: "Germany - Frankfurt", region: "Europe" },
  { value: "jp-tok", label: "Japan - Tokyo", region: "Asia" },
  { value: "au-syd", label: "Australia - Sydney", region: "Oceania" },
  { value: "br-sao", label: "Brazil - São Paulo", region: "South America" },
];

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [selectedServer, setSelectedServer] = useState(servers[0].value);
  const [logs, setLogs] = useState<string[]>(["Welcome to SuperTunnel."]);
  const [uptime, setUptime] = useState(0);
  const [data, setData] = useState({ down: 0, up: 0 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    let uptimeInterval: NodeJS.Timeout;
    let dataInterval: NodeJS.Timeout;

    if (status === "connected") {
      setUptime(0);
      setData({ down: 0, up: 0 });
      uptimeInterval = setInterval(() => setUptime((s) => s + 1), 1000);
      dataInterval = setInterval(() => {
        setData((d) => ({
          down: d.down + Math.random() * 1.5,
          up: d.up + Math.random() * 0.5,
        }));
      }, 1500);
    }

    return () => {
      clearInterval(uptimeInterval);
      clearInterval(dataInterval);
    };
  }, [status]);

  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleConnectToggle = () => {
    if (status === "connected") {
      setStatus("disconnected");
      addLog("Connection terminated.");
      setUptime(0);
      setData({ down: 0, up: 0 });
    } else if (status === "disconnected") {
      setStatus("connecting");
      const serverLabel = servers.find((s) => s.value === selectedServer)?.label;
      addLog(`Connecting to ${serverLabel}...`);
      setTimeout(() => {
        setStatus("connected");
        addLog(`Successfully connected to ${serverLabel}.`);
        addLog("AES-256 encryption enabled.");
        addLog("Your traffic is now secure.");
      }, 2500);
    }
  };

  const handleAnalyzeLogs = () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    addLog("AI analysis started...");
    setTimeout(() => {
      const mockAnalysis = `Stable connection with 82ms latency and no packet loss. Rates are optimal for HD streaming. For better performance, consider switching to '${servers[1].label}'.`;
      setAnalysis(mockAnalysis);
      addLog("AI analysis complete.");
      setIsAnalyzing(false);
    }, 2000);
  };

  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          text: "Connected",
          color: "text-green-500",
          icon: <ShieldCheck className="h-5 w-5 text-green-500" />,
          buttonText: "Disconnect",
          buttonVariant: "destructive" as const,
        };
      case "connecting":
        return {
          text: "Connecting...",
          color: "text-yellow-500",
          icon: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />,
          buttonText: "Connecting",
          buttonVariant: "secondary" as const,
        };
      case "disconnected":
      default:
        return {
          text: "Disconnected",
          color: "text-red-500",
          icon: <ShieldOff className="h-5 w-5 text-red-500" />,
          buttonText: "Connect",
          buttonVariant: "default" as const,
        };
    }
  };

  const { text, color, icon, buttonText, buttonVariant } = getStatusInfo();

  return (
    <div className="w-[380px] h-[600px] bg-background text-foreground flex flex-col items-center p-4">
      <header className="w-full flex items-center justify-center gap-2 pb-4">
        <Icons.logo className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">SuperTunnel</h1>
      </header>
      <main className="w-full flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              {icon}
              <span className={`text-lg font-semibold ${color}`}>{text}</span>
            </div>
            <Button
              size="lg"
              variant={buttonVariant}
              className="h-16 w-full text-base"
              onClick={handleConnectToggle}
              disabled={status === "connecting"}
            >
              <Power className="h-6 w-6 mr-2" />
              <span>{buttonText}</span>
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
            <Select
              value={selectedServer}
              onValueChange={setSelectedServer}
              disabled={status !== "disconnected"}
            >
              <SelectTrigger className="w-full h-10 text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select a server" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {servers.map((server) => (
                  <SelectItem key={server.value} value={server.value} className="text-sm">
                    {server.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="flex flex-col flex-grow">
          <CardHeader className="p-4">
            <CardTitle className="text-base">Activity Logs</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow p-4 pt-0 min-h-0">
            <ScrollArea className="h-[120px] w-full rounded-md border p-2 font-mono text-xs">
              {logs.map((log, i) => (
                <p key={i} className="whitespace-pre-wrap leading-snug">
                  {log}
                </p>
              ))}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 p-4 pt-0">
            {analysis && (
              <Alert className="p-2">
                <Sparkles className="h-3 w-3" />
                <AlertTitle className="text-xs font-semibold mb-0.5">AI Analysis</AlertTitle>
                <AlertDescription className="text-xs">{analysis}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleAnalyzeLogs}
              disabled={isAnalyzing}
              className="w-full h-9 text-sm bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Analyze Logs
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
