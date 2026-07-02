import {
  Activity,
  Bell,
  Car,
  ClipboardList,
  Coins,
  Database,
  Gauge,
  Gavel,
  HardDrive,
  History,
  Home,
  KeyRound,
  LogOut,
  Menu,
  MessageSquareWarning,
  MonitorPlay,
  Package,
  Search,
  Settings,
  Shield,
  TerminalSquare,
  UserCog,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { clsx, formatDate } from "../lib/format";
import { useA2Socket, useAuth, useToast } from "../contexts";
import type { DashboardStats } from "../types";
import { Badge, Button, Input, Modal } from "./ui";

const nav = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Live Players", href: "/players/live", icon: Users },
  { label: "Player Search", href: "/players/search", icon: Search },
  { label: "Reports", href: "/reports", icon: ClipboardList },
  { label: "Bans", href: "/bans", icon: Gavel },
  { label: "Warnings", href: "/warnings", icon: MessageSquareWarning },
  { label: "Vehicles", href: "/vehicles", icon: Car },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Money", href: "/money", icon: Coins },
  { label: "Jobs & Gangs", href: "/jobs-gangs", icon: Shield },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Discord", href: "/discord", icon: Bell },
  { label: "Live View", href: "/live-view", icon: MonitorPlay },
  { label: "Console", href: "/console", icon: TerminalSquare },
  { label: "Logs", href: "/logs", icon: History },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function Layout() {
  const { user, logout } = useAuth();
  const socket = useA2Socket();
  const { pushToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const location = useLocation();

  useEffect(() => {
    void api<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch((error) => pushToast({ level: "error", title: "Dashboard status failed", message: error.message }));
  }, [location.pathname, pushToast]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on("server.status", () => void api<DashboardStats>("/dashboard/stats").then(setStats).catch(() => undefined));
    socket.on("players.updated", () => void api<DashboardStats>("/dashboard/stats").then(setStats).catch(() => undefined));
    return () => {
      socket.off("server.status");
      socket.off("players.updated");
    };
  }, [socket]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const serverName = "A2 Panel";

  return (
    <div className="min-h-screen bg-a2-bg text-zinc-100">
      <div className="pointer-events-none fixed inset-0 a2-grid-bg opacity-60" />
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="relative lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-a2-bg/88 backdrop-blur-xl">
          {!stats?.serverOnline ? (
            <div className="border-b border-yellow-300/20 bg-yellow-400/8 px-4 py-2 text-sm text-yellow-100">
              FiveM bridge offline. Live actions will queue and dashboard live data will stay limited until `a2_panel_bridge` connects.
            </div>
          ) : null}
          <div className="flex min-h-16 items-center gap-3 px-4">
            <Button variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-white">{serverName}</h1>
                <Badge tone={stats?.serverOnline ? "green" : "yellow"}>{stats?.serverOnline ? "Online" : "Bridge offline"}</Badge>
                <span className="text-sm text-zinc-400">
                  {stats ? `${stats.playersOnline}/${stats.maxPlayers} players` : "Loading status"}
                </span>
              </div>
              {stats?.bridgeLastSeen ? <p className="text-xs text-zinc-500">Bridge last seen {formatDate(stats.bridgeLastSeen)}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden min-h-10 w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-left text-sm text-zinc-500 transition hover:border-a2-green/40 md:flex"
            >
              <Search className="h-4 w-4" />
              Search players, plates, pages
              <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-xs">Ctrl K</span>
            </button>
            <Button variant="ghost" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="hidden items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 md:flex">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-a2-green text-sm font-black text-black">A2</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.displayName}</p>
                <p className="text-xs text-zinc-500">{user?.roleName}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={logout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="relative mx-auto grid w-full max-w-[1800px] gap-5 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const content = (
    <aside className="flex h-full flex-col border-r border-white/8 bg-[#070907]/96 p-4 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <NavLink to="/" className="flex items-center gap-3" onClick={onClose}>
          <motion.div animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 28px rgba(183,254,26,0.32)", "0 0 0 rgba(183,254,26,0)"] }} transition={{ duration: 2.5, repeat: Infinity }} className="grid h-11 w-11 place-items-center rounded-lg bg-a2-green font-black text-black">
            A2
          </motion.div>
          <div>
            <p className="text-lg font-black text-white">A2 Panel</p>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">FiveM Control</p>
          </div>
        </NavLink>
        <Button variant="ghost" className="lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="grid gap-1 overflow-y-auto pr-1">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                "group relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/[0.05] hover:text-white",
                isActive && "bg-a2-green/10 text-white shadow-glow"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? <span className="absolute left-0 top-2 h-6 w-1 rounded-r bg-a2-green shadow-glow" /> : null}
                <item.icon className={clsx("h-4 w-4", isActive && "text-a2-green")} />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-a2-green/15 bg-a2-green/8 p-3 text-sm text-zinc-300">
        <div className="mb-2 flex items-center gap-2 text-a2-green">
          <KeyRound className="h-4 w-4" />
          Demo login
        </div>
        <p>admin / admin</p>
        <p className="mt-2 text-xs text-zinc-500">Change this immediately after deployment.</p>
      </div>
    </aside>
  );

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{content}</div>
      {open ? <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={onClose} /> : null}
      <div className={clsx("fixed inset-y-0 left-0 z-50 w-72 transform transition lg:hidden", open ? "translate-x-0" : "-translate-x-full")}>{content}</div>
    </>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const items = useMemo(() => nav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  function go(href: string) {
    navigate(href);
    onClose();
    setQuery("");
  }

  return (
    <Modal open={open} title="A2 Panel Command Palette" onClose={onClose}>
      <div className="grid gap-3">
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a page, player ID, citizen ID, or plate" />
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-white/10">
          {items.map((item) => (
            <button key={item.href} type="button" onClick={() => go(item.href)} className="flex w-full items-center gap-3 border-b border-white/6 px-3 py-3 text-left text-sm text-zinc-200 transition last:border-b-0 hover:bg-white/[0.05]">
              <item.icon className="h-4 w-4 text-a2-green" />
              {item.label}
            </button>
          ))}
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                if (/^[A-Za-z0-9:-]+$/.test(query.trim())) go(`/players/${encodeURIComponent(query.trim())}`);
                else pushToast({ level: "warning", title: "Search needs an identifier", message: "Use Player Search for broader text search." });
              }}
              className="flex w-full items-center gap-3 border-b border-white/6 px-3 py-3 text-left text-sm text-zinc-200 transition last:border-b-0 hover:bg-white/[0.05]"
            >
              <Database className="h-4 w-4 text-a2-green" />
              Open profile for "{query.trim()}"
            </button>
          )}
          {!items.length && !query.trim() ? <p className="px-3 py-8 text-center text-sm text-zinc-500">Start typing to jump through A2 Panel.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" onClick={() => go("/players/live")}><Activity className="h-4 w-4" /> Live</Button>
          <Button variant="secondary" onClick={() => go("/reports")}><ClipboardList className="h-4 w-4" /> Reports</Button>
          <Button variant="secondary" onClick={() => go("/console")}><HardDrive className="h-4 w-4" /> Console</Button>
          <Button variant="secondary" onClick={() => go("/settings")}><Gauge className="h-4 w-4" /> Settings</Button>
        </div>
      </div>
    </Modal>
  );
}
