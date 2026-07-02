import { Activity, BellRing, ClipboardList, Gauge, Gavel, Server, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, DataTable, Panel, StatCard } from "../components/ui";
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

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-a2-green">Command center</p>
          <h1 className="mt-1 text-3xl font-black text-white">A2 Panel Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/announcements"><Button variant="secondary"><BellRing className="h-4 w-4" /> Announce</Button></Link>
          <Link to="/console"><Button variant="secondary"><Server className="h-4 w-4" /> Open Console</Button></Link>
          <Link to="/players/search"><Button variant="primary"><Users className="h-4 w-4" /> Search Player</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Server Status" value={stats?.serverOnline ? "Online" : "Offline"} detail={stats?.bridgeLastSeen ? `Last seen ${formatDate(stats.bridgeLastSeen)}` : "Bridge has not connected"} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Players Online" value={`${stats?.playersOnline ?? 0}/${stats?.maxPlayers ?? 64}`} detail={<div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-a2-green" style={{ width: `${playerRatio}%` }} /></div>} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Open Reports" value={stats?.reportsPending ?? 0} detail={`${stats?.ticketsPending ?? 0} active tickets`} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Discipline" value={`${stats?.totalBans ?? 0} / ${stats?.totalWarnings ?? 0}`} detail="Active bans / warnings" icon={<Gavel className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Live Load" eyebrow="Realtime">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Ping", stats?.performance.ping ? `${stats.performance.ping} ms` : "Pending", Gauge],
              ["CPU", stats?.performance.cpu ? `${stats.performance.cpu}%` : "Bridge metric", Activity],
              ["Memory", stats?.performance.memory ? `${stats.performance.memory} MB` : "Bridge metric", Server]
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-400">{label as string}</p>
                  <Icon className="h-4 w-4 text-a2-green" />
                </div>
                <p className="text-2xl font-black text-white">{value as string}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid h-48 grid-cols-12 items-end gap-2">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="rounded-t bg-a2-green/80" style={{ height: `${18 + ((index * 13 + playerRatio) % 78)}%`, opacity: 0.36 + index / 22 }} />
            ))}
          </div>
        </Panel>
        <Panel title="Module Status" eyebrow="Readiness">
          <div className="grid gap-2">
            {Object.entries(stats?.moduleStatus ?? {}).map(([module, status]) => (
              <div key={module} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
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

      <Panel title="Recent Admin Activity" eyebrow="Audit" actions={<Badge tone="green"><ShieldCheck className="mr-1 h-3 w-3" /> Logged</Badge>}>
        <DataTable
          rows={activity as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No audit activity yet."
          columns={[
            { key: "createdAt", label: "Time", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "staffName", label: "Staff", sortable: true },
            { key: "actionType", label: "Action", sortable: true },
            { key: "targetPlayer", label: "Target" },
            { key: "success", label: "Result", render: (row) => <Badge tone={row.success ? "green" : "red"}>{row.success ? "Success" : "Failed"}</Badge> }
          ]}
        />
      </Panel>
    </div>
  );
}
