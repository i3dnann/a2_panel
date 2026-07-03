import { motion } from "framer-motion";
import { Activity, BellRing, CheckCircle2, ClipboardList, Eye, Gavel, Lock, LogIn, Megaphone, Package, Radio, ScrollText, Server, ShieldCheck, Terminal, User, UserCog, Users, Wallet, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useToast } from "../contexts";
import { Button, Input } from "../components/ui";
import { api, setToken } from "../lib/api";

const panelFunctions = [
  { title: "Live players", detail: "IDs, ping, jobs, money, IP, HWID, and quick actions.", icon: Users },
  { title: "Player search", detail: "Find online or offline QBCore characters by ID, citizen ID, name, license, or plate.", icon: User },
  { title: "Bans & proof", detail: "A2 and QBCore bans with proof links, uploads, and Discord logs.", icon: Gavel },
  { title: "Warnings", detail: "Track discipline history and remove warnings with logged confirmation.", icon: ShieldCheck },
  { title: "Inventory", detail: "Give, remove, clear, and inspect stashes without leaving the panel.", icon: Package },
  { title: "Money", detail: "Inspect cash/bank balances and send controlled economy actions.", icon: Wallet },
  { title: "Reports", detail: "Claim, reply, close, and delete support reports from one queue.", icon: ClipboardList },
  { title: "Announcements", detail: "Broadcast polished server announcements from the panel.", icon: Megaphone },
  { title: "Discord/webhooks", detail: "Send detailed moderation embeds to the configured Discord channels.", icon: BellRing },
  { title: "Player watch", detail: "Low-FPS screenshot watch with guarded refreshes.", icon: Eye },
  { title: "Console/logs", detail: "Read audit history and console-style operation feedback.", icon: Terminal },
  { title: "Server monitoring", detail: "Bridge status, players online, staff presence, and moderation pressure.", icon: Server },
  { title: "Staff control", detail: "Owner-controlled staff roles, permissions, Admin, and God access.", icon: UserCog }
];

const previewRows = [
  { id: 12, name: "Mikael Storm", job: "police", ping: "42ms", status: "ADMIN" },
  { id: 27, name: "Nora Vale", job: "mechanic", ping: "65ms", status: "ONLINE" },
  { id: 44, name: "Elias Hunt", job: "ambulance", ping: "58ms", status: "ONLINE" }
];

export function LoginPage() {
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginState, setLoginState] = useState<"idle" | "success" | "failed">("idle");
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");
    const params = new URLSearchParams(window.location.search);
    const discordError = params.get("discord_error");
    if (token) {
      setToken(token);
      window.history.replaceState({}, "", "/");
      window.location.replace("/");
      return;
    }
    if (discordError) {
      pushToast({ level: "error", title: "Discord login failed", message: discordError });
      window.history.replaceState({}, "", "/login");
    }
  }, [pushToast]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setLoginState("idle");
    try {
      await login(username, password, remember);
      setLoginState("success");
      navigate(from, { replace: true });
    } catch (error) {
      setLoginState("failed");
      pushToast({ level: "error", title: "Login failed", message: error instanceof Error ? error.message : "Invalid credentials" });
    } finally {
      setLoading(false);
    }
  }

  async function discordLogin() {
    try {
      const response = await api<{ url: string }>("/auth/discord/url", { auth: false });
      window.location.href = response.url;
    } catch (error) {
      pushToast({
        level: "error",
        title: "Discord login is not configured",
        message: error instanceof Error ? error.message : "Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI on the backend."
      });
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#060708] px-4 py-5 text-white">
      <div className="pointer-events-none absolute inset-0 animated-bg opacity-55" />
      <div className="pointer-events-none absolute inset-0 a2-aurora opacity-85" />
      <div className="pointer-events-none absolute inset-0 a2-grid-bg opacity-45" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1440px] gap-5">
        <header className="sticky top-4 z-20 flex w-full max-w-[calc(100vw-2rem)] items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#080b0f]/82 px-3 py-3 shadow-panel backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 34px rgba(183,254,26,0.26)", "0 0 0 rgba(183,254,26,0)"] }}
              transition={{ duration: 2.6, repeat: Infinity }}
              className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-a2-green/35 bg-a2-green/12 text-a2-green"
            >
              <img src="/assets/a2-logo.png" alt="" className="h-full w-full object-cover" />
            </motion.div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">A2 Panel</p>
              <p className="truncate text-xs text-zinc-500">FiveM control room for QBCore servers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/demo">
              <Button variant="secondary" className="shrink-0 px-2 sm:px-3">Try Demo</Button>
            </Link>
            <Button
              variant="primary"
              className="shrink-0 px-2 sm:px-3"
              onClick={() => document.getElementById("login-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Sign In</span>
            </Button>
          </div>
        </header>

        <main className="grid w-full max-w-[calc(100vw-2rem)] min-w-0 items-stretch gap-5 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="grid min-w-0 gap-5">
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="grid w-full max-w-full min-w-0 gap-5 rounded-xl border border-white/10 bg-[#0a0e12]/90 p-5 shadow-panel backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="flex min-h-[420px] min-w-0 flex-col justify-between gap-6">
                <div>
                  <h1 className="max-w-2xl text-4xl font-black leading-[1.04] tracking-normal text-white md:text-7xl">
                    A2 Panel
                    <span className="block bg-gradient-to-r from-a2-green via-[#d5ff62] to-[#8bc415] bg-clip-text text-transparent">total control</span>
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                    A fast FiveM staff panel for live players, QBCore bans, reports, inventory, vehicles, money, jobs, Discord logs, and owner-only permission control.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button variant="primary" onClick={() => document.getElementById("login-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                      <LogIn className="h-4 w-4" /> Sign In
                    </Button>
                    <Link to="/demo">
                      <Button variant="secondary" className="w-full sm:w-auto">
                        <Eye className="h-4 w-4" /> Try Demo
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Bridge" value="Live" icon={<Radio className="h-4 w-4" />} />
                  <Metric label="Actions" value="Queued" icon={<Activity className="h-4 w-4" />} />
                  <Metric label="Logs" value="Discord" icon={<BellRing className="h-4 w-4" />} />
                </div>
              </div>

              <motion.div
                id="panel-preview"
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12, duration: 0.5 }}
                className="relative min-w-0 overflow-hidden rounded-xl border border-a2-green/25 bg-[#0a0f12] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
              >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-sm font-bold text-white">Panel Example</p>
                    <p className="text-xs text-zinc-400">Live players and moderation snapshot</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-a2-green/12 px-2.5 py-1 text-xs font-bold text-a2-green">
                    <span className="h-2 w-2 rounded-full bg-a2-green shadow-glow" /> Online
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PreviewStat label="Players" value="48/128" />
                  <PreviewStat label="Active bans" value="12" />
                  <PreviewStat label="Reports" value="4" />
                </div>
                <div className="mt-4 overflow-hidden rounded-md border border-white/10">
                  {previewRows.map((row, index) => (
                    <motion.div
                      key={row.id}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.18 + index * 0.08 }}
                      className="grid grid-cols-[44px_minmax(80px,1fr)_64px_58px] items-center gap-2 border-b border-white/10 bg-white/[0.025] px-3 py-3 text-xs last:border-b-0 sm:grid-cols-[52px_1fr_92px_76px] sm:gap-3 sm:text-sm"
                    >
                      <span className="a2-mono text-xs text-zinc-500">#{row.id}</span>
                      <span className="truncate font-semibold text-white">{row.name}</span>
                      <span className="truncate text-zinc-300">{row.job}</span>
                      <span className={row.status === "ADMIN" ? "text-a2-green" : "text-zinc-500"}>{row.status}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {panelFunctions.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + index * 0.04 }}
                  className="glass-card rounded-xl p-4 transition hover:-translate-y-1 hover:border-a2-green/25"
                >
                  <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-a2-green/20 bg-a2-green/10 text-a2-green">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-bold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
                </motion.div>
              ))}
            </section>

            <section className="grid gap-4 rounded-xl border border-a2-green/15 bg-[#0a0c0e]/84 p-5 shadow-panel backdrop-blur-xl lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-a2-green">
                  <ScrollText className="h-4 w-4" /> Panel workflow
                </div>
                <h2 className="text-2xl font-black text-white">Built for live moderation, not a static website.</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  The real panel keeps its current handlers and server bridge. This landing page simply gives staff a polished overview before signing in.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {["Live players", "Player search", "Reports", "Bans", "Warnings", "Staff", "Announcements", "Discord/webhooks", "Console/logs", "Server monitoring"].map((label) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-zinc-300">
                    {label}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <motion.form
            id="login-form"
            initial={false}
            animate={loginState === "failed" ? { opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -6, 6, 0] } : { opacity: 1, y: 0, scale: 1, x: 0 }}
            transition={{ duration: loginState === "failed" ? 0.36 : 0.55, ease: "easeOut" }}
            className="a2-glass sticky top-24 grid h-fit min-w-0 w-full max-w-full gap-5 rounded-xl p-6 shadow-panel"
            onSubmit={submit}
          >
            <div>
              <h2 className="text-2xl font-bold">Staff Login</h2>
              <p className="mt-1 text-sm text-zinc-500">Sign in to open the live control panel.</p>
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={discordLogin}>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#5865f2] text-xs font-black text-white">D</span>
              Continue with Discord
            </Button>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm text-zinc-400">
                <span>Email or username</span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} className="pl-9" autoComplete="username" />
                </div>
              </label>
              <label className="grid gap-1.5 text-sm text-zinc-400">
                <span>Password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9" type="password" autoComplete="current-password" />
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-zinc-400">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-a2-green" />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => pushToast({ level: "info", title: "Password reset", message: "Ask an Owner to reset your password from Staff." })}
                className="font-medium text-a2-green hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" variant="primary" loading={loading} className="w-full">
              {loginState === "success" ? <CheckCircle2 className="h-4 w-4" /> : loginState === "failed" ? <XCircle className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {loginState === "success" ? "Login Approved" : loginState === "failed" ? "Try Again" : "Sign In"}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              No account?{" "}
              <button
                type="button"
                onClick={() => pushToast({ level: "info", title: "Staff accounts are private", message: "Create staff accounts inside the Staff page after logging in." })}
                className="font-semibold text-a2-green hover:underline"
              >
                Create one
              </button>
            </p>
          </motion.form>
        </main>

        <footer className="grid gap-3 border-t border-white/10 py-6 text-sm text-zinc-500 sm:flex sm:items-center sm:justify-between">
          <span>A2 Panel - premium FiveM control room</span>
          <div className="flex gap-4">
            <Link className="hover:text-a2-green" to="/demo">Try Demo</Link>
            <button className="hover:text-a2-green" type="button" onClick={() => document.getElementById("login-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Sign In</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 text-a2-green">{icon}</div>
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black text-a2-green">{value}</p>
    </div>
  );
}
