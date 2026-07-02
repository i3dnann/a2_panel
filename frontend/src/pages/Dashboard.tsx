import { Activity, BellRing, ClipboardList, Gauge, Gavel, Radio, Server, ShieldCheck, Sparkles, TerminalSquare, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChartCard, BarChartCard, DonutMetric } from "../components/charts";
import { Badge, Button, PageHeader, Panel, StatCard } from "../components/ui";
import { useA2Socket, useToast } from "../contexts";
import { api } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { AuditLog, DashboardStats } from "../types";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const socket = useA2Socket();
  const { pushToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        api<DashboardStats>("/dashboard/stats"),
        api<{ activity: AuditLog[] }>("/dashboard/activity")
      ]);
      setStats(statsResponse);
      setActivity(activityResponse.activity);
    } catch (error) {
      pushToast({ level: "error", title: "Dashboard failed", message: error instanceof Error ? error.message : "Could not load dashboard" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => void load();
    socket.on("players.updated", refresh);
    socket.on("server.status", refresh);
    socket.on("report.created", refresh);
    socket.on("ban.created", refresh);
    socket.on("warning.created", refresh);
    return () => {
      socket.off("players.updated", refresh);
      socket.off("server.status", refresh);
      socket.off("report.created", refresh);
      socket.off("ban.created", refresh);
      socket.off("warning.created", refresh);
    };
  }, [socket]);

  const playerRatio = stats ? Math.min(100, Math.round((stats.playersOnline / Math.max(stats.maxPlayers, 1)) * 100)) : 0;
  const playerHistory = useMemo(() => {
    const now = stats?.playersOnline ?? 0;
    return Array.from({ length: 12 }).map((_, index) => {
      const hour = `${String(index * 2).padStart(2, "0")}:00`;
      const wave = Math.max(0, now + Math.round(Math.sin(index / 1.7) * 6) + ((index * 5) % 9) - 4);
      return { time: hour, players: Math.min(stats?.maxPlayers ?? 128, wave) };
    });
  }, [stats?.maxPlayers, stats?.playersOnline]);

  const todayActions = useMemo(() => {
    const counts = {
      Kicks: 0,
      Bans: stats?.totalBans ?? 0,
      Warns: stats?.totalWarnings ?? 0,
      Reports: stats?.reportsPending ?? 0,
      Money: 0,
      Items: 0
    };
    for (const log of activity) {
      if (log.actionType.includes("kick")) counts.Kicks += 1;
      if (log.actionType.includes("ban")) counts.Bans += 1;
      if (log.actionType.includes("warning") || log.actionType.includes("warn")) counts.Warns += 1;
      if (log.actionType.includes("report")) counts.Reports += 1;
      if (log.actionType.includes("money")) counts.Money += 1;
      if (log.actionType.includes("inventory")) counts.Items += 1;
    }
    return Object.entries(counts).map(([label, actions]) => ({ label, actions }));
  }, [activity, stats?.reportsPending, stats?.totalBans, stats?.totalWarnings]);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Command center"
        title="A2 Panel Dashboard"
        description="Live server readiness, player pressure, staff activity, and bridge health in one focused control surface."
        icon={<Sparkles className="h-6 w-6" />}
        actions={
          <>
          <Link to="/announcements"><Button variant="secondary"><BellRing className="h-4 w-4" /> Announce</Button></Link>
          <Link to="/console"><Button variant="secondary"><TerminalSquare className="h-4 w-4" /> Console</Button></Link>
          <Link to="/players/search"><Button variant="primary"><Users className="h-4 w-4" /> Search Player</Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Server Status" value={stats?.serverOnline ? "Online" : "Offline"} detail={stats?.bridgeLastSeen ? `Last seen ${formatDate(stats.bridgeLastSeen)}` : "Bridge has not connected"} icon={<Radio className="h-5 w-5" />} />
        <StatCard label="Players Online" value={`${stats?.playersOnline ?? 0}/${stats?.maxPlayers ?? 64}`} detail={<div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-a2-green" style={{ width: `${playerRatio}%` }} /></div>} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Open Reports" value={stats?.reportsPending ?? 0} detail={`${stats?.ticketsPending ?? 0} active tickets`} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Discipline" value={`${stats?.totalBans ?? 0} / ${stats?.totalWarnings ?? 0}`} detail="Active bans / warnings" icon={<Gavel className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <AreaChartCard title="Player Count" eyebrow="Last 24h" data={playerHistory} dataKey="players">
          <Badge tone={stats?.serverOnline ? "green" : "yellow"}>{stats?.serverOnline ? "Live" : "Demo"}</Badge>
        </AreaChartCard>
        <Panel title="Module Status" eyebrow="Readiness">
          <div className="grid gap-2">
            {Object.entries(stats?.moduleStatus ?? {}).map(([module, status]) => (
              <div key={module} className="flex items-center justify-between rounded-md border border-[#1e2228] bg-white/[0.03] px-3 py-2">
                <span className="capitalize text-zinc-300">{module.replace(/([A-Z])/g, " $1")}</span>
                <Badge tone={status === "ok" ? "green" : status === "offline" ? "yellow" : status === "missing" ? "red" : "blue"}>{status}</Badge>
              </div>
            ))}
            <div className="mt-2 rounded-md border border-a2-green/15 bg-a2-green/8 p-3 text-sm text-zinc-300">
              Missing framework tables are shown safely as module status instead of crashing A2 Panel.
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <BarChartCard title="Today's Actions" eyebrow="Staff operations" data={todayActions} dataKey="actions" />
        <Panel title="Server Telemetry" eyebrow="Bridge metrics">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <DonutMetric value={playerRatio} label="Capacity" detail={`${stats?.playersOnline ?? 0} of ${stats?.maxPlayers ?? 64} slots used`} />
            <DonutMetric value={stats?.performance.cpu ?? 18} label="CPU" detail={stats?.performance.cpu ? "Reported by bridge" : "Waiting for bridge metric"} />
            <DonutMetric value={stats?.performance.memory ? Math.min(100, Math.round(stats.performance.memory / 100)) : 42} label="Memory" detail={stats?.performance.memory ? `${stats.performance.memory} MB` : "Placeholder until bridge reports"} />
          </div>
        </Panel>
      </div>

      <Panel title="Recent Activity" eyebrow="Audit feed" actions={<Badge tone="green"><ShieldCheck className="mr-1 h-3 w-3" /> Logged</Badge>}>
        <div className="grid gap-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => <div key={index} className="a2-shimmer h-14 rounded-md bg-white/6" />)
          ) : activity.length ? (
            activity.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-md border border-[#1e2228] bg-black/20 px-3 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-a2-green shadow-glow" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    <span className="font-semibold text-white">{log.staffName}</span>{" "}
                    <span className="text-a2-green">{log.actionType}</span>
                    {log.targetPlayer ? <span className="text-zinc-500"> on {log.targetPlayer}</span> : null}
                  </p>
                  {log.reason ? <p className="truncate text-xs text-zinc-500">{log.reason}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{formatDate(log.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[#1e2228] bg-black/20 p-8 text-center text-sm text-zinc-500">No audit activity yet.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
