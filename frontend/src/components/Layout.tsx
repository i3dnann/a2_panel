import {
  Activity,
  Bell,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Command,
  Database,
  Eye,
  Gavel,
  History,
  Home,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareWarning,
  Package,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { clsx } from "../lib/format";
import { useA2Socket, useAuth, useToast } from "../contexts";
import type { DashboardStats } from "../types";
import { Button, Input, Modal } from "./ui";

type NavItem = { label: string; href: string; icon: LucideIcon };
type PanelNotification = { id: number; title: string; message?: string; level?: "success" | "error" | "info" | "warning"; createdAt?: string };

const nav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Live Players", href: "/players/live", icon: Users },
  { label: "Player Search", href: "/players/search", icon: Search },
  { label: "Reports", href: "/reports", icon: ClipboardList },
  { label: "Bans", href: "/bans", icon: Gavel },
  { label: "Warnings", href: "/warnings", icon: MessageSquareWarning },
  { label: "Vehicles", href: "/vehicles", icon: Car },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Money", href: "/money", icon: Coins },
  { label: "Jobs & Gangs", href: "/jobs-gangs", icon: ShieldCheck },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Discord", href: "/discord", icon: Bell },
  { label: "Live View", href: "/live-view", icon: Eye },
  { label: "Audit Logs", href: "/logs", icon: History },
  { label: "Settings", href: "/settings", icon: Settings }
];

function notificationHref(item: PanelNotification) {
  const text = `${item.title} ${item.message ?? ""}`.toLowerCase();
  if (text.includes("report")) return "/reports";
  if (text.includes("ban")) return "/bans";
  if (text.includes("warning")) return "/warnings";
  if (text.includes("staff")) return "/staff";
  if (text.includes("discord")) return "/discord";
  if (text.includes("player")) return "/players/live";
  return "/logs";
}

export function Layout() {
  const { user, logout } = useAuth();
  const socket = useA2Socket();
  const { pushToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PanelNotification[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void api<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch((error) => pushToast({ level: "error", title: "Dashboard status failed", message: error.message }));
  }, [location.pathname, pushToast]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => void api<DashboardStats>("/dashboard/stats").then(setStats).catch(() => undefined);
    socket.on("server.status", refresh);
    socket.on("players.updated", refresh);
    socket.on("notification.created", (payload: Omit<PanelNotification, "id">) => {
      setNotifications((current) => [{ ...payload, id: Date.now() + Math.floor(Math.random() * 1000) }, ...current].slice(0, 12));
    });
    return () => {
      socket.off("server.status", refresh);
      socket.off("players.updated", refresh);
      socket.off("notification.created");
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

  const serverOnline = Boolean(stats?.serverOnline);
  const initials = (user?.displayName || user?.username || "A2")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#060708] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 a2-aurora opacity-65" />
      <div className="pointer-events-none fixed inset-0 a2-grid-bg opacity-35" />
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <div className={clsx("relative transition-[padding] duration-300", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <header className="sticky top-0 z-30 border-b border-[#181e22] bg-[#07090b]/92 backdrop-blur-xl">
          <div className="flex min-h-[58px] items-center gap-3 px-4 md:px-5">
            <Button variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className={clsx("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold", serverOnline ? "bg-a2-green/12 text-a2-green" : "bg-red-500/12 text-red-200")}>
                <span className={clsx("h-2 w-2 rounded-full", serverOnline ? "bg-a2-green shadow-glow" : "bg-red-400")} />
                {serverOnline ? "Online" : "Offline"}
              </span>
              <span className="hidden truncate text-sm font-medium text-zinc-300 sm:inline">
                {serverOnline ? "Server Online" : "Server Offline"}
              </span>
              {stats ? <span className="a2-mono hidden text-xs text-zinc-600 md:inline">{stats.playersOnline}/{stats.maxPlayers}</span> : null}
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden min-h-9 w-full max-w-sm items-center gap-2 rounded-md border border-[#1d242a] bg-[#07090b]/80 px-3 text-left text-sm text-zinc-500 transition hover:border-a2-green/35 hover:bg-white/[0.035] md:flex"
            >
              <Search className="h-4 w-4" />
              Search
              <span className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[11px]">
                <Command className="h-3 w-3" /> K
              </span>
            </button>

            <div className="relative">
              <Button
                variant="ghost"
                aria-label="Open notifications"
                className="relative"
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Bell className="h-5 w-5" />
                {notifications.length ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-a2-green px-1 text-[10px] font-black text-black shadow-glow">{notifications.length}</span> : null}
              </Button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-11 z-50 w-[min(390px,calc(100vw-2rem))] rounded-md border border-[#1d242a] bg-[#080b0f]/98 p-2 shadow-panel">
                  <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    <button type="button" onClick={() => setNotifications([])} className="text-xs text-zinc-500 hover:text-a2-green">Clear all</button>
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-y-auto">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setNotifications((current) => current.filter((candidate) => candidate.id !== item.id));
                          setNotificationsOpen(false);
                          navigate(notificationHref(item));
                        }}
                        className="rounded-md border border-white/5 bg-white/[0.025] px-3 py-2 text-left transition hover:border-a2-green/25"
                      >
                        <p className={clsx("text-sm font-semibold", item.level === "error" ? "text-red-200" : item.level === "warning" ? "text-yellow-100" : "text-a2-green")}>{item.title}</p>
                        {item.message ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.message}</p> : null}
                        {item.createdAt ? <p className="mt-1 text-[11px] text-zinc-700">{new Date(item.createdAt).toLocaleString()}</p> : null}
                      </button>
                    ))}
                    {!notifications.length ? <p className="px-3 py-8 text-center text-sm text-zinc-500">No important notifications.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <img src="/assets/a2-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.displayName ?? user?.username}</p>
                <p className="text-xs text-zinc-500">{user?.roleName}</p>
              </div>
            </div>

            <Button variant="ghost" onClick={logout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="relative mx-auto grid w-full max-w-[1720px] gap-5 p-4 md:p-5">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const content = (
    <aside className={clsx("flex h-full flex-col border-r border-[#181e22] bg-[#080b0f]/96 py-3 backdrop-blur-xl transition-all", collapsed ? "lg:w-16" : "lg:w-60")}>
      <div className="mb-3 flex items-center gap-3 px-3">
        <NavLink to="/" className={clsx("flex min-w-0 flex-1 items-center gap-3", collapsed && "lg:justify-center")} onClick={onClose}>
          <motion.div
            animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 24px rgba(183,254,26,0.26)", "0 0 0 rgba(183,254,26,0)"] }}
            transition={{ duration: 2.8, repeat: Infinity }}
            className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-a2-green/35 bg-a2-green/12 text-a2-green"
          >
            <img src="/assets/a2-logo.png" alt="" className="h-full w-full object-cover" />
          </motion.div>
          <span className={clsx("truncate text-base font-bold text-white", collapsed && "lg:hidden")}>A2 Panel</span>
        </NavLink>
        <Button variant="ghost" className="lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="grid gap-0.5 overflow-y-auto px-2 pb-2">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              clsx(
                "group relative flex min-h-8 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-white",
                collapsed && "lg:justify-center lg:px-0",
                isActive && "bg-a2-green/[0.06] text-a2-green"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? <span className="absolute left-0 top-1 h-6 w-1 rounded-r bg-a2-green shadow-glow" /> : null}
                <item.icon className={clsx("h-4 w-4 shrink-0", isActive ? "text-a2-green" : "text-zinc-600 group-hover:text-zinc-300")} />
                <span className={clsx("truncate", collapsed && "lg:hidden")}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2">
        <Button variant="ghost" className="min-h-8 w-full text-[13px]" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          <span className={clsx(collapsed && "lg:hidden")}>{collapsed ? "Expand" : "Collapse"}</span>
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className={clsx("fixed inset-y-0 left-0 z-40 hidden lg:block", collapsed ? "w-16" : "w-60")}>{content}</div>
      {open ? <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={onClose} /> : null}
      <div className={clsx("fixed inset-y-0 left-0 z-50 w-60 transform transition lg:hidden", open ? "translate-x-0" : "-translate-x-full")}>{content}</div>
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
            <button key={item.href} type="button" onClick={() => go(item.href)} className="flex w-full items-center gap-3 border-b border-[#1d242a] px-3 py-3 text-left text-sm text-zinc-200 transition last:border-b-0 hover:bg-white/[0.05]">
              <item.icon className="h-4 w-4 text-a2-green" />
              {item.label}
            </button>
          ))}
          {query.trim() ? (
            <button
              type="button"
              onClick={() => {
                if (/^[A-Za-z0-9:-]+$/.test(query.trim())) go(`/players/${encodeURIComponent(query.trim())}`);
                else pushToast({ level: "warning", title: "Search needs an identifier", message: "Use Player Search for broader text search." });
              }}
              className="flex w-full items-center gap-3 border-b border-[#1d242a] px-3 py-3 text-left text-sm text-zinc-200 transition last:border-b-0 hover:bg-white/[0.05]"
            >
              <Database className="h-4 w-4 text-a2-green" />
              Open profile for "{query.trim()}"
            </button>
          ) : null}
          {!items.length && !query.trim() ? <p className="px-3 py-8 text-center text-sm text-zinc-500">Start typing to jump through A2 Panel.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" onClick={() => go("/players/live")}><Activity className="h-4 w-4" /> Live</Button>
          <Button variant="secondary" onClick={() => go("/reports")}><ClipboardList className="h-4 w-4" /> Reports</Button>
          <Button variant="secondary" onClick={() => go("/logs")}><History className="h-4 w-4" /> Logs</Button>
          <Button variant="primary" onClick={() => go("/players/search")}><Search className="h-4 w-4" /> Search</Button>
        </div>
      </div>
    </Modal>
  );
}
