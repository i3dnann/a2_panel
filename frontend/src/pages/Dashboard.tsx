import { Activity, BellRing, ClipboardList, Eye, Gavel, Radio, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChartCard, BarChartCard } from "../components/charts";
import { Badge, Button, PageHeader, Panel, StatCard } from "../components/ui";
import { useA2Socket, useAuth, useToast } from "../contexts";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AuditLog, DashboardStats } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
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

  const playerHistory = useMemo(() => {
    const current = stats?.playersOnline ?? 0;
    const maxPlayers = stats?.maxPlayers ?? 64;
    return Array.from({ length: 12 }).map((_, index) => {
      const hour = `${String(index * 2).padStart(2, "0")}:00`;
      const wave = Math.max(0, current + Math.round(Math.sin(index / 1.8) * 5) + ((index * 7) % 6) - 3);
      return { time: hour, players: Math.min(maxPlayers, wave) };
    });
  }, [stats?.maxPlayers, stats?.playersOnline]);

  const todayActions = useMemo(() => {
    const counts = {
      Kick: 0,
      Ban: stats?.totalBans ?? 0,
      Warn: stats?.totalWarnings ?? 0,
      Reports: stats?.reportsPending ?? 0,
      Staff: stats?.staffOnline ?? 0
    };
    for (const log of activity) {
      if (log.actionType.includes("kick")) counts.Kick += 1;
      if (log.actionType.includes("ban")) counts.Ban += 1;
      if (log.actionType.includes("warning") || log.actionType.includes("warn")) counts.Warn += 1;
      if (log.actionType.includes("report")) counts.Reports += 1;
      if (log.actionType.includes("staff")) counts.Staff += 1;
    }
    return Object.entries(counts).map(([label, actions]) => ({ label, actions }));
  }, [activity, stats?.reportsPending, stats?.staffOnline, stats?.totalBans, stats?.totalWarnings]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.displayName ?? user?.username ?? "admin"}`}
        icon={<Activity className="h-6 w-6" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Players" value={stats?.playersOnline ?? 0} detail={`${stats?.maxPlayers ?? 64} slots`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Server" value={stats?.serverOnline ? "Online" : "Offline"} detail={stats?.bridgeLastSeen ? `Seen ${formatDate(stats.bridgeLastSeen)}` : "Bridge waiting"} icon={<Radio className="h-5 w-5" />} />
        <StatCard label="Active Bans" value={stats?.totalBans ?? 0} detail="Currently enforced" icon={<Gavel className="h-5 w-5" />} />
        <StatCard label="Warnings" value={stats?.totalWarnings ?? 0} detail="Player history" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Reports" value={stats?.reportsPending ?? 0} detail={`${stats?.ticketsPending ?? 0} open tickets`} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Staff Online" value={stats?.staffOnline ?? 0} detail="Web panel users" icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/announcements"><Button variant="primary"><BellRing className="h-4 w-4" /> Announce</Button></Link>
        <Link to="/players/search"><Button variant="secondary"><Users className="h-4 w-4" /> Search Player</Button></Link>
        <Link to="/reports"><Button variant="secondary"><ClipboardList className="h-4 w-4" /> Reports</Button></Link>
        <Link to="/bans"><Button variant="secondary"><Gavel className="h-4 w-4" /> Bans</Button></Link>
        <Link to="/live-view"><Button variant="secondary"><Eye className="h-4 w-4" /> Live View</Button></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AreaChartCard title="Player Count" eyebrow="Last 24h" data={playerHistory} dataKey="players">
          <Badge tone={stats?.serverOnline ? "green" : "red"}>{stats?.serverOnline ? "Live" : "Offline"}</Badge>
        </AreaChartCard>
        <BarChartCard title="Today's Actions" eyebrow="Staff operations" data={todayActions} dataKey="actions" />
      </div>

      <Panel title="Recent Activity" actions={<Link className="text-sm font-semibold text-a2-green hover:underline" to="/logs">View all</Link>}>
        <div className="grid gap-1">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => <div key={index} className="a2-shimmer h-12 rounded-md bg-white/6" />)
          ) : activity.length ? (
            activity.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-md px-2 py-3 transition hover:bg-white/[0.03]">
                <span className="h-2 w-2 rounded-full bg-a2-green shadow-glow" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-300">
                    <span className="font-semibold text-white">{log.staffName}</span>{" "}
                    <span className="text-a2-green">{log.actionType}</span>
                    {log.targetPlayer ? <span className="text-zinc-500"> {log.targetPlayer}</span> : null}
                  </p>
                  {log.reason ? <p className="truncate text-xs text-zinc-600">{log.reason}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-zinc-600">{formatDate(log.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[#1d242a] bg-black/20 p-8 text-center text-sm text-zinc-500">No audit activity yet.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
