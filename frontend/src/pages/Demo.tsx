import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Briefcase,
  Car,
  ChevronLeft,
  ClipboardList,
  Coins,
  Eye,
  Gavel,
  Home,
  LogIn,
  Megaphone,
  MonitorDot,
  Package,
  Radio,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  UserCog,
  Users,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, DataTable, Panel, StatCard } from "../components/ui";
import { useToast } from "../contexts";
import { clsx } from "../lib/format";

type DemoSection =
  | "Dashboard"
  | "Live Players"
  | "Player Search"
  | "Reports"
  | "Bans"
  | "Warnings"
  | "Vehicles"
  | "Inventory"
  | "Money"
  | "Jobs/Gangs"
  | "Announcements"
  | "Staff"
  | "Discord/Webhooks"
  | "Live View"
  | "Console"
  | "Logs"
  | "Settings";

const demoNav: Array<{ label: DemoSection; icon: LucideIcon }> = [
  { label: "Dashboard", icon: Home },
  { label: "Live Players", icon: Users },
  { label: "Player Search", icon: Search },
  { label: "Reports", icon: ClipboardList },
  { label: "Bans", icon: Gavel },
  { label: "Warnings", icon: AlertTriangle },
  { label: "Vehicles", icon: Car },
  { label: "Inventory", icon: Package },
  { label: "Money", icon: Coins },
  { label: "Jobs/Gangs", icon: Briefcase },
  { label: "Announcements", icon: Megaphone },
  { label: "Staff", icon: UserCog },
  { label: "Discord/Webhooks", icon: Bell },
  { label: "Live View", icon: Eye },
  { label: "Console", icon: Terminal },
  { label: "Logs", icon: ScrollText },
  { label: "Settings", icon: Settings }
];

const players = [
  { id: 12, name: "Mikael Storm", citizenId: "A2B941", job: "police", ping: "42ms", status: "Admin" },
  { id: 27, name: "Nora Vale", citizenId: "B8Q229", job: "mechanic", ping: "65ms", status: "Online" },
  { id: 44, name: "Elias Hunt", citizenId: "K7A120", job: "ambulance", ping: "58ms", status: "Online" },
  { id: 51, name: "Sara Knox", citizenId: "P9C441", job: "unemployed", ping: "71ms", status: "Frozen" }
];

const logs = [
  { id: 1, staff: "Demo Owner", action: "banned", target: "Ryder Frost", time: "2m ago" },
  { id: 2, staff: "ModSarah", action: "claimed report", target: "#R-1042", time: "14m ago" },
  { id: 3, staff: "Demo Owner", action: "gave item", target: "Mikael Storm", time: "33m ago" },
  { id: 4, staff: "SupportTim", action: "sent webhook", target: "Discord", time: "1h ago" }
];

const moduleRows: Record<DemoSection, Array<Record<string, string | number>>> = {
  Dashboard: logs,
  "Live Players": players,
  "Player Search": players.map((player) => ({ ...player, match: "citizenid / license / name" })),
  Reports: [
    { id: "R-1042", player: "Nora Vale", subject: "Stuck vehicle", status: "Open" },
    { id: "R-1043", player: "Elias Hunt", subject: "Lost inventory", status: "Claimed" }
  ],
  Bans: [
    { id: "B-901", player: "Ryder Frost", reason: "Combat logging", proof: "2 files", status: "Active" },
    { id: "B-902", player: "Alex Reed", reason: "Exploiting", proof: "Discord link", status: "Expired" }
  ],
  Warnings: [
    { id: "W-211", player: "Mikael Storm", reason: "Fail RP", staff: "Demo Owner" },
    { id: "W-212", player: "Nora Vale", reason: "VDM warning", staff: "ModSarah" }
  ],
  Vehicles: [
    { plate: "A2DEMO", owner: "Mikael Storm", model: "sultanrs", garage: "pillbox" },
    { plate: "LIME42", owner: "Nora Vale", model: "drafter", garage: "casino" }
  ],
  Inventory: [
    { slot: 1, item: "radio", amount: 1, owner: "Mikael Storm" },
    { slot: 2, item: "repairkit", amount: 3, owner: "Nora Vale" }
  ],
  Money: [
    { player: "Mikael Storm", cash: "$4,250", bank: "$128,500", crypto: "$0" },
    { player: "Nora Vale", cash: "$1,320", bank: "$42,950", crypto: "$450" }
  ],
  "Jobs/Gangs": [
    { player: "Mikael Storm", job: "police", grade: "sergeant", gang: "none" },
    { player: "Elias Hunt", job: "ambulance", grade: "doctor", gang: "none" }
  ],
  Announcements: [
    { id: "A-1", title: "Restart in 15 minutes", channel: "txAdmin", status: "Draft" },
    { id: "A-2", title: "Community event tonight", channel: "Server", status: "Sent" }
  ],
  Staff: [
    { user: "Demo Owner", role: "Owner", permissions: "All" },
    { user: "ModSarah", role: "Admin", permissions: "Moderation" }
  ],
  "Discord/Webhooks": [
    { webhook: "Bans", status: "Connected", last: "2m ago" },
    { webhook: "Reports", status: "Connected", last: "14m ago" }
  ],
  "Live View": [
    { player: "Mikael Storm", mode: "Spectate placeholder", status: "Ready" },
    { player: "Nora Vale", mode: "Snapshot placeholder", status: "Demo only" }
  ],
  Console: [
    { time: "14:22:10", command: "a2.demo.refresh", result: "Simulated success" },
    { time: "14:22:13", command: "a2.demo.webhook", result: "No real webhook sent" }
  ],
  Logs: logs,
  Settings: [
    { setting: "Bridge heartbeat", value: "Demo online", status: "Mock" },
    { setting: "Webhook delivery", value: "Simulated", status: "Mock" }
  ]
};

const demoStats = [
  { label: "Players", value: "64", detail: "128 slots", icon: <Users className="h-5 w-5" /> },
  { label: "Server", value: "Online", detail: "Demo bridge", icon: <Wifi className="h-5 w-5" /> },
  { label: "Active Bans", value: "12", detail: "Mock records", icon: <Gavel className="h-5 w-5" /> },
  { label: "Reports", value: "7", detail: "2 urgent", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Warnings", value: "28", detail: "History view", icon: <AlertTriangle className="h-5 w-5" /> },
  { label: "Staff", value: "3", detail: "Online", icon: <ShieldCheck className="h-5 w-5" /> }
];

export function DemoPage() {
  const [active, setActive] = useState<DemoSection>("Dashboard");
  const { pushToast } = useToast();
  const rows = moduleRows[active];

  const columns = useMemo(() => {
    const sample = rows[0] ?? {};
    return Object.keys(sample).map((key) => ({
      key,
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()),
      sortable: true,
      render: (row: Record<string, unknown>) => {
        const value = row[key];
        if (key === "status") {
          const text = String(value);
          const tone = text.toLowerCase().includes("active") || text.toLowerCase().includes("online") || text.toLowerCase().includes("connected") ? "green" : text.toLowerCase().includes("frozen") || text.toLowerCase().includes("draft") ? "yellow" : "neutral";
          return <Badge tone={tone}>{text}</Badge>;
        }
        return <span className={key === "id" || key === "plate" || key === "time" ? "a2-mono text-a2-green" : undefined}>{String(value ?? "")}</span>;
      }
    }));
  }, [rows]);

  function simulate(label = "Demo action simulated") {
    pushToast({ level: "info", title: label, message: "Demo mode uses local mock data only. No API, database, webhook, or server command was called." });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#060708] text-white">
      <div className="pointer-events-none fixed inset-0 animated-bg opacity-55" />
      <div className="pointer-events-none fixed inset-0 a2-grid-bg opacity-40" />
      <div className="pointer-events-none fixed inset-0 a2-aurora opacity-70" />

      <div className="relative grid min-h-screen lg:grid-cols-[224px_1fr]">
        <aside className="hidden border-r border-[#1e2228] bg-[#0a0c0e]/92 py-3 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="mb-3 flex h-11 items-center gap-3 border-b border-[#1e2228] px-4 pb-3">
            <img src="/assets/a2-logo.png" alt="" className="h-9 w-9 rounded-lg border border-a2-green/30 object-cover" />
            <div>
              <p className="font-black">A2 Panel</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-a2-green">Demo Mode</p>
            </div>
          </div>
          <nav className="grid gap-0.5 overflow-y-auto px-2">
            {demoNav.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActive(item.label)}
                className={clsx(
                  "group relative flex min-h-9 items-center gap-3 rounded-lg px-3 text-left text-[13px] font-semibold transition",
                  active === item.label ? "sidebar-active bg-a2-green/[0.075] text-a2-green" : "text-zinc-500 hover:bg-[#111418] hover:text-zinc-200"
                )}
              >
                <item.icon className={clsx("h-4 w-4", active === item.label ? "text-a2-green" : "text-zinc-600 group-hover:text-zinc-300")} />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[#1e2228] bg-[#0a0c0e]/86 px-4 backdrop-blur-xl">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Badge tone="green"><Radio className="mr-1 h-3 w-3" /> Demo Mode</Badge>
              <span className="hidden text-sm text-zinc-500 sm:inline">Local mock data only</span>
            </div>
            <Button variant="secondary" onClick={() => simulate()}>
              Simulate Action
            </Button>
            <Link to="/login">
              <Button variant="primary"><LogIn className="h-4 w-4" /> Sign In</Button>
            </Link>
          </header>

          <div className="grid gap-5 p-4 md:p-5">
            <div className="-mx-4 flex gap-2 overflow-x-auto border-b border-[#1e2228]/70 px-4 pb-3 lg:hidden">
              {demoNav.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActive(item.label)}
                  className={clsx(
                    "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition",
                    active === item.label ? "border-a2-green/35 bg-a2-green/12 text-a2-green" : "border-[#1e2228] bg-[#111418]/75 text-zinc-400"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-a2-green/20 bg-a2-green/10 p-3 text-sm text-a2-green shadow-glow">
              Demo Mode: all actions are simulated, all records are local mock data, and nothing is sent to the real server.
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-a2-green/20 bg-a2-green/10 text-a2-green shadow-glow">
                  {(() => {
                    const Icon = demoNav.find((item) => item.label === active)?.icon ?? Activity;
                    return <Icon className="h-6 w-6" />;
                  })()}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-a2-green">Public preview</p>
                  <h1 className="text-2xl font-black text-white sm:text-3xl">{active}</h1>
                  <p className="mt-1 max-w-3xl text-sm text-zinc-500">A visual-only preview of the real A2 Panel layout and module styling.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => simulate(`${active} demo action simulated`)}>Run Demo Action</Button>
                <Link to="/login"><Button variant="primary">Open Real Panel</Button></Link>
              </div>
            </div>

            {active === "Dashboard" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  {demoStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
                </div>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <Panel title="Player Count" eyebrow="Last 24h demo">
                    <div className="grid h-72 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-1.5">
                      {Array.from({ length: 24 }).map((_, index) => (
                        <motion.div
                          key={index}
                          initial={{ height: 0 }}
                          animate={{ height: `${24 + ((index * 19) % 68)}%` }}
                          transition={{ duration: 0.45, delay: index * 0.015 }}
                          className="rounded-t bg-gradient-to-t from-a2-green/35 to-a2-green"
                        />
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Server Monitoring" eyebrow="Demo sensors">
                    <div className="grid gap-3">
                      {["Bridge heartbeat", "Discord webhooks", "Screenshot guard", "Action audit trail"].map((label, index) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border border-[#1e2228] bg-white/[0.025] p-3">
                          <div className="flex items-center gap-3">
                            <MonitorDot className="h-4 w-4 text-a2-green" />
                            <span className="text-sm font-semibold text-zinc-200">{label}</span>
                          </div>
                          <Badge tone={index === 2 ? "yellow" : "green"}>{index === 2 ? "Guarded" : "Online"}</Badge>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </>
            ) : null}

            {active === "Console" ? (
              <Panel title="Console" eyebrow="No real commands run">
                <div className="terminal-scan min-h-72 rounded-xl border border-[#1e2228] bg-black/60 p-4 font-mono text-sm text-a2-green">
                  <p>{">"} demo.boot --panel=a2</p>
                  <p>{">"} bridge status: simulated online</p>
                  <p>{">"} webhook send: skipped in demo mode</p>
                  <p>{">"} database write: blocked by design</p>
                  <p className="animate-pulse">{">"} waiting for demo input...</p>
                </div>
              </Panel>
            ) : (
              <Panel title={`${active} Data`} eyebrow="Mock local dataset" actions={<Button variant="secondary" onClick={() => simulate()}>Demo action</Button>}>
                <DataTable rows={rows} columns={columns} searchPlaceholder={`Search ${active.toLowerCase()}`} empty="No demo rows." />
              </Panel>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
