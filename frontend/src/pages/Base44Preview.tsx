import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  ChevronLeft,
  Command,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  Map,
  MessageSquareWarning,
  Radio,
  Search,
  Shield,
  ShieldBan,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Panel } from "../components/ui";
import { clsx } from "../lib/format";

type PreviewNavItem = [label: string, Icon: LucideIcon, active: boolean];

const navGroups: Array<{ title: string; items: PreviewNavItem[] }> = [
  {
    title: "Operations",
    items: [
      ["Dashboard", LayoutDashboard, true],
      ["Live Players", Users, false],
      ["Reports", MessageSquareWarning, false],
      ["Live View", Map, false]
    ]
  },
  {
    title: "Control",
    items: [
      ["Bans", ShieldBan, false],
      ["Audit Logs", LockKeyhole, false]
    ]
  }
];

const players = [
  { id: 12, name: "Adnan West", cid: "A2B941", job: "police", ping: 32, state: "Online" },
  { id: 21, name: "Milo Anders", cid: "B8Q229", job: "mechanic", ping: 48, state: "Frozen" },
  { id: 37, name: "Lina Shore", cid: "K7A120", job: "ambulance", ping: 28, state: "Online" }
];

export function Base44PreviewPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#060708] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_8%,rgba(183,254,26,0.14),transparent_28rem),radial-gradient(circle_at_88%_18%,rgba(255,255,255,0.07),transparent_24rem),linear-gradient(180deg,#060708,#0a0c0e)]" />
      <div className="pointer-events-none fixed inset-0 a2-grid-bg opacity-45" />

      <div className="relative grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-[#1e2228] bg-[#0a0c0e]/80 p-4 backdrop-blur-xl lg:block">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 34px rgba(183,254,26,0.34)", "0 0 0 rgba(183,254,26,0)"] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="grid h-11 w-11 place-items-center rounded-lg border border-a2-green/40 bg-a2-green/12 text-a2-green"
              >
                <Shield className="h-6 w-6" />
              </motion.div>
              <div>
                <p className="text-lg font-black">A2 Panel</p>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Core Control</p>
              </div>
            </div>
            <button className="rounded-md border border-[#1e2228] p-2 text-zinc-500">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">{group.title}</p>
                <div className="grid gap-1">
                  {group.items.map(([label, Icon, active]) => (
                    <button
                      key={String(label)}
                      className={clsx(
                        "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                        active ? "border border-a2-green/20 bg-a2-green/10 text-white shadow-glow" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      {active ? <span className="absolute left-0 top-2 h-7 w-1 rounded-r bg-a2-green shadow-glow" /> : null}
                      <Icon className={clsx("h-4 w-4", active && "text-a2-green")} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="grid grid-rows-[72px_1fr]">
          <header className="flex items-center gap-3 border-b border-[#1e2228] bg-[#0a0c0e]/70 px-5 backdrop-blur-xl">
            <div className="flex flex-1 items-center gap-3">
              <Badge tone="green"><Radio className="mr-1 h-3 w-3" /> Server Online</Badge>
              <span className="text-sm text-zinc-400">48 / 128 players</span>
            </div>
            <button className="hidden h-10 min-w-[360px] items-center gap-2 rounded-md border border-[#1e2228] bg-black/25 px-3 text-left text-sm text-zinc-500 md:flex">
              <Search className="h-4 w-4" />
              Search player, citizen ID, plate...
              <span className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-xs">
                <Command className="h-3 w-3" /> K
              </span>
            </button>
            <button className="rounded-md border border-[#1e2228] bg-white/[0.03] p-2 text-zinc-300">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 rounded-md border border-[#1e2228] bg-white/[0.03] px-3 py-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-a2-green text-xs font-black text-black">AO</div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold">A2 Owner</p>
                <p className="text-xs text-zinc-500">owner</p>
              </div>
            </div>
          </header>

          <div className="grid gap-5 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-a2-green">
                  <Sparkles className="h-4 w-4" /> Base44 style preview
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-normal">Premium FiveM command center</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  This is an example direction only: grouped sidebar, glass cards, stronger A2 identity, richer top bar, live metrics, and clearer bridge-dependent states.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary"><LockKeyhole className="h-4 w-4" /> Audit Logs</Button>
                <Button variant="primary"><Zap className="h-4 w-4" /> Quick Action</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Online Players", "48", "+12% from last hour", Users],
                ["Active Bans", "16", "3 expire today", ShieldBan],
                ["Open Reports", "7", "2 urgent", MessageSquareWarning],
                ["Bridge Latency", "28ms", "heartbeat healthy", Activity]
              ].map(([label, value, detail, Icon]) => (
                <motion.div
                  key={String(label)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-a2-green/12 bg-[#111418]/80 p-4 shadow-panel backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">{label as string}</p>
                      <p className="mt-3 text-3xl font-black">{value as string}</p>
                      <p className="mt-2 text-sm text-zinc-500">{detail as string}</p>
                    </div>
                    <div className="rounded-md border border-a2-green/20 bg-a2-green/10 p-2 text-a2-green">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <Panel title="Live Player Pressure" eyebrow="Realtime chart">
                <div className="grid h-72 grid-cols-[repeat(18,minmax(0,1fr))] items-end gap-2">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ height: 0 }}
                      animate={{ height: `${24 + ((index * 17) % 68)}%` }}
                      transition={{ delay: index * 0.025 }}
                      className="rounded-t bg-gradient-to-t from-a2-green/35 to-a2-green"
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Bridge Required States" eyebrow="Dependency aware">
                <div className="grid gap-3">
                  {[
                    ["Inventory editor", "Ready after QBCore item hook", "yellow"],
                    ["Screenshot request", "Requires screenshot-basic", "blue"],
                    ["Live map", "Waiting for coordinate stream", "yellow"],
                    ["Audit logging", "Every staff action is recorded", "green"]
                  ].map(([label, detail, tone]) => (
                    <div key={label} className="flex items-center justify-between rounded-md border border-[#1e2228] bg-white/[0.03] p-3">
                      <div>
                        <p className="font-semibold">{label}</p>
                        <p className="text-sm text-zinc-500">{detail}</p>
                      </div>
                      <Badge tone={tone as "green" | "yellow" | "blue"}>{tone}</Badge>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Live Players" eyebrow="Action table">
              <div className="overflow-hidden rounded-lg border border-[#1e2228]">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-white/[0.04] text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-3">ID</th>
                      <th className="px-3 py-3">Character</th>
                      <th className="px-3 py-3">Citizen ID</th>
                      <th className="px-3 py-3">Job</th>
                      <th className="px-3 py-3">Ping</th>
                      <th className="px-3 py-3">State</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className="border-t border-[#1e2228] hover:bg-white/[0.035]">
                        <td className="px-3 py-3 font-mono text-a2-green">#{player.id}</td>
                        <td className="px-3 py-3 font-semibold">{player.name}</td>
                        <td className="px-3 py-3 font-mono text-zinc-400">{player.cid}</td>
                        <td className="px-3 py-3">{player.job}</td>
                        <td className="px-3 py-3">{player.ping}ms</td>
                        <td className="px-3 py-3"><Badge tone={player.state === "Frozen" ? "yellow" : "green"}>{player.state}</Badge></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <Button variant="secondary">View</Button>
                            <Button variant="danger">Ban</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="rounded-lg border border-a2-green/20 bg-a2-green/8 p-4 text-sm text-zinc-300">
              <div className="mb-2 flex items-center gap-2 text-a2-green">
                <Gauge className="h-4 w-4" />
                Approval checkpoint
              </div>
              If you like this direction, I can apply it to the real Dashboard, Login, Sidebar, TopBar, Live Players, and module pages, then build and push after you approve.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
