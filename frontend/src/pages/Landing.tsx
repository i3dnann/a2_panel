import { motion, useInView } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Briefcase,
  Car,
  ClipboardList,
  Cloud,
  Coins,
  Eye,
  Gavel,
  Lock,
  Megaphone,
  Package,
  Radio,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCog,
  Users,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";

const stats = [
  { label: "Modules", value: 24, suffix: "+", icon: Zap },
  { label: "Actions", value: 64, suffix: "", icon: Activity },
  { label: "Control", value: 99, suffix: "%", icon: ShieldCheck },
  { label: "Events Logged", value: 1280, suffix: "+", icon: BellRing }
];

const modules: Array<{ title: string; detail: string; icon: LucideIcon }> = [
  { title: "Live Players", detail: "Track IDs, ping, jobs, money, permissions, and live staff actions.", icon: Users },
  { title: "Player Search", detail: "Find online or offline QBCore characters by name, ID, license, or plate.", icon: Search },
  { title: "Bans", detail: "Review active bans, evidence, QBCore records, and moderation history.", icon: Gavel },
  { title: "Warnings", detail: "Keep discipline history visible and easy for senior staff to audit.", icon: AlertTriangle },
  { title: "Reports", detail: "Claim, reply, resolve, and follow up from one focused support queue.", icon: ClipboardList },
  { title: "Inventory", detail: "Inspect and manage items with guarded, permission-controlled actions.", icon: Package },
  { title: "Money", detail: "Review balances and run economy actions from a controlled workflow.", icon: Coins },
  { title: "Vehicles", detail: "Search, give, remove, and inspect owned vehicles with clean table views.", icon: Car },
  { title: "Jobs & Gangs", detail: "Set job and gang roles using framework-aware options.", icon: Briefcase },
  { title: "Announcements", detail: "Send polished broadcasts to players when staff needs attention.", icon: Megaphone },
  { title: "Discord Logs", detail: "Ship detailed moderation embeds to configured staff channels.", icon: BellRing },
  { title: "Console", detail: "A terminal-style view for command feedback and operational signals.", icon: Terminal },
  { title: "Server Monitoring", detail: "Watch bridge health, server status, activity pressure, and staff presence.", icon: Server },
  { title: "Player Watch", detail: "Use guarded screenshot monitoring without hammering the server.", icon: Eye }
];

const reliability = [
  { title: "Framework Agnostic", detail: "Designed around FiveM staff workflows with QBCore-ready integrations.", icon: Radio },
  { title: "Cloud Hosted", detail: "A clean web panel experience your staff can open from anywhere.", icon: Cloud },
  { title: "Secure by Design", detail: "Permission roles, owner controls, and audit logs keep actions accountable.", icon: Lock },
  { title: "Built for Staff", detail: "Compact pages, fast tables, and calm controls for real moderation work.", icon: UserCog }
];

const actionData = [7, 12, 5, 15, 11, 18, 13, 20];

export function LandingPage() {
  const [pointer, setPointer] = useState({ x: 50, y: 30 });

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  }

  return (
    <div className="landing-shell relative min-h-screen overflow-x-hidden bg-[#050607] text-white" onPointerMove={updatePointer}>
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{ background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(183,254,26,0.12), transparent 22rem)` }}
      />
      <div className="pointer-events-none fixed inset-0 landing-grid opacity-65" />
      <div className="pointer-events-none fixed inset-0 landing-scanlines opacity-55" />
      <div className="pointer-events-none fixed inset-0 landing-rain opacity-25" />

      <LandingNav />
      <main>
        <Hero />
        <ModulesSection />
        <ChartsSection />
        <StepsSection />
        <ReliabilitySection />
        <BottomCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050607]/78 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/assets/a2-logo.png" alt="" className="h-9 w-9 rounded-lg border border-a2-green/25 object-cover shadow-glow" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">A2 Panel</p>
            <p className="hidden text-[11px] text-zinc-500 sm:block">FiveM staff control system</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-zinc-500 md:flex">
          <a className="transition hover:text-a2-green" href="#features">Features</a>
          <Link className="transition hover:text-a2-green" to="/demo">Live Demo</Link>
          <a className="transition hover:text-a2-green" href="#modules">Modules</a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link to="/demo"><Button variant="secondary" className="min-h-8 px-3 text-xs sm:text-sm">Try Demo</Button></Link>
          <Link to="/login"><Button variant="primary" className="min-h-8 px-3 text-xs sm:text-sm">Sign In</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mb-7 inline-flex items-center gap-2 rounded-full border border-a2-green/20 bg-a2-green/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-a2-green"
      >
        <Sparkles className="h-4 w-4" />
        FiveM control panel
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
        className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-7xl lg:text-8xl"
      >
        Run your server with
        <span className="mt-3 block bg-gradient-to-r from-a2-green via-[#d4ff5a] to-[#8bc415] bg-clip-text text-transparent">
          total control
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.18, ease: "easeOut" }}
        className="mt-7 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg"
      >
        A fast live staff panel for players, bans, reports, inventory, vehicles, money, jobs, Discord logs, and owner-only permission control.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.28, ease: "easeOut" }}
        className="mt-9 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row"
      >
        <Link to="/login" className="w-full sm:w-auto">
          <Button variant="primary" className="h-12 w-full px-8 text-base sm:w-auto">
            Sign in to Panel <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <a href="#features" className="w-full sm:w-auto">
          <Button variant="secondary" className="h-12 w-full px-8 text-base sm:w-auto">Explore Features</Button>
        </a>
      </motion.div>

      <div className="mt-16 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => <StatPreview key={stat.label} stat={stat} index={index} />)}
      </div>
    </section>
  );
}

function StatPreview({ stat, index }: { stat: (typeof stats)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const value = useCountUp(inView ? stat.value : 0, 1500);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="glass-card rounded-xl p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_0_34px_rgba(183,254,26,0.13)]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-a2-green/20 bg-a2-green/10 text-a2-green">
          <stat.icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-zinc-500">{stat.label}</span>
      </div>
      <p className="a2-mono text-3xl font-black text-a2-green">
        {value.toLocaleString()}{stat.suffix}
      </p>
    </motion.div>
  );
}

function ModulesSection() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeader label="Core Modules" title="Everything your staff needs in one panel" />
      <div id="modules" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((item, index) => (
          <RevealCard key={item.title} index={index}>
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-a2-green/20 bg-a2-green/10 text-a2-green">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
          </RevealCard>
        ))}
      </div>
    </section>
  );
}

function ChartsSection() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeader label="Live Monitoring" title="Real-time insight at a glance" />
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <PreviewChart title="Player count" subtitle="Last 24 hours">
          <svg viewBox="0 0 640 260" className="h-64 w-full overflow-visible">
            <defs>
              <linearGradient id="landingArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#b7fe1a" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#b7fe1a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 224 L0 164 C58 140 82 178 122 134 C164 88 196 126 236 100 C288 66 316 92 358 76 C410 56 452 92 492 68 C552 32 592 58 640 44 L640 224 Z" fill="url(#landingArea)" />
            <motion.path
              d="M0 164 C58 140 82 178 122 134 C164 88 196 126 236 100 C288 66 316 92 358 76 C410 56 452 92 492 68 C552 32 592 58 640 44"
              fill="none"
              stroke="#b7fe1a"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
        </PreviewChart>

        <PreviewChart title="Action volume" subtitle="Staff operations">
          <div className="grid h-64 grid-cols-8 items-end gap-3 px-2">
            {actionData.map((value, index) => (
              <motion.div
                key={index}
                className="rounded-t-lg bg-gradient-to-t from-[#6f980e] to-a2-green shadow-[0_0_22px_rgba(183,254,26,0.12)]"
                initial={{ height: 0 }}
                whileInView={{ height: `${24 + value * 3.2}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.58, delay: index * 0.05, ease: "easeOut" }}
              />
            ))}
          </div>
        </PreviewChart>
      </div>
    </section>
  );
}

function StepsSection() {
  const steps = [
    ["01", "Sign in securely", "Use your staff account and permission role."],
    ["02", "Act with confidence", "Search players, review evidence, and run actions from one place."],
    ["03", "Stay in control", "Every action is logged for owners and senior staff."]
  ];
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
      <SectionHeader label="Workflow" title="Live in three steps" />
      <div className="relative mt-10 grid gap-4 md:grid-cols-3">
        <div className="absolute left-[15%] right-[15%] top-10 hidden h-px bg-gradient-to-r from-transparent via-a2-green/30 to-transparent md:block" />
        {steps.map(([number, title, detail], index) => (
          <RevealCard key={title} index={index} className="relative text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-a2-green/25 bg-a2-green/10 a2-mono text-sm font-black text-a2-green shadow-glow">
              {number}
            </div>
            <h3 className="text-lg font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
          </RevealCard>
        ))}
      </div>
    </section>
  );
}

function ReliabilitySection() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeader label="Reliability" title="Engineered for reliability" />
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reliability.map((item, index) => (
          <RevealCard key={item.title} index={index}>
            <item.icon className="mb-5 h-6 w-6 text-a2-green" />
            <h3 className="text-lg font-black text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
          </RevealCard>
        ))}
      </div>
    </section>
  );
}

function BottomCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <div className="glass-card relative overflow-hidden rounded-2xl p-8 text-center shadow-panel sm:p-12">
        <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-a2-green to-transparent" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-a2-green">A2 Panel</p>
        <h2 className="mt-4 text-4xl font-black text-white sm:text-5xl">Ready to take control?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
          Open the real panel when you are ready, or use the public demo to preview the staff experience without touching live data.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login"><Button variant="primary" className="h-12 w-full px-8 sm:w-auto">Sign in to Panel</Button></Link>
          <Link to="/demo"><Button variant="secondary" className="h-12 w-full px-8 sm:w-auto">Try Demo</Button></Link>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/assets/a2-logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-semibold text-zinc-300">A2 Panel</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <span>© A2 Panel</span>
          <span>FiveM staff control system</span>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-a2-green">{label}</p>
      <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">{title}</h2>
    </div>
  );
}

function RevealCard({ children, index, className }: { children: ReactNode; index: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.42, delay: Math.min(index * 0.045, 0.22), ease: "easeOut" }}
      className={`glass-card rounded-xl p-5 transition hover:-translate-y-1 hover:shadow-[0_0_34px_rgba(183,254,26,0.12)] ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

function PreviewChart({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">{subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-a2-green/20 bg-a2-green/10 px-3 py-1 text-xs font-bold text-a2-green">
          <span className="h-2 w-2 rounded-full bg-a2-green shadow-glow" />
          Live
        </span>
      </div>
      {children}
    </div>
  );
}

function useCountUp(target: number, duration: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) {
      setValue(0);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, target]);
  return value;
}
