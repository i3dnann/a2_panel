import { motion } from "framer-motion";
import { Lock, LogIn, Radio, Server, ShieldCheck, Sparkles, User } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useToast } from "../contexts";
import { Button, Field, Input } from "../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(username, password, remember);
      navigate(from, { replace: true });
    } catch (error) {
      pushToast({ level: "error", title: "Login failed", message: error instanceof Error ? error.message : "Invalid credentials" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#060708] px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 a2-aurora opacity-90" />
      <div className="pointer-events-none absolute inset-0 a2-grid-bg opacity-60" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-a2-green/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="hidden lg:block">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-a2-green/20 bg-a2-green/10 px-3 py-1 text-sm font-semibold text-a2-green shadow-glow">
              <Sparkles className="h-4 w-4" />
              Premium FiveM operations
            </div>
            <h1 className="text-6xl font-black leading-none tracking-normal md:text-7xl">A2 Panel</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              A secure control room for live players, reports, bans, staff permissions, audit logs, Discord routing, and bridge-backed server actions.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["JWT", "Secured sessions"],
                ["SQL", "MySQL ready"],
                ["Bridge", "Live FiveM sync"]
              ].map(([label, detail]) => (
                <div key={label} className="rounded-lg border border-[#1e2228] bg-[#111418]/72 p-3 text-sm text-zinc-300 backdrop-blur">
                  <p className="a2-mono text-a2-green">{label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-lg border border-a2-green/15 bg-a2-green/8 p-4 text-sm leading-6 text-zinc-300">
              <div className="mb-2 flex items-center gap-2 font-semibold text-a2-green">
                <Radio className="h-4 w-4" />
                Bridge-aware by design
              </div>
              When the FiveM bridge is offline, A2 Panel shows safe queue states instead of broken controls.
            </div>
          </motion.div>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="a2-glass mx-auto grid w-full max-w-md gap-5 rounded-lg p-6 shadow-panel"
          onSubmit={submit}
        >
          <div className="text-center">
            <motion.div
              animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 38px rgba(183,254,26,0.34)", "0 0 0 rgba(183,254,26,0)"] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-xl border border-a2-green/40 bg-a2-green/12 text-a2-green"
            >
              <ShieldCheck className="h-8 w-8" />
            </motion.div>
            <h2 className="mt-4 text-2xl font-black">A2 Panel</h2>
            <p className="mt-1 text-sm text-zinc-500">Staff command access</p>
          </div>

          <Field label="Username">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input value={username} onChange={(event) => setUsername(event.target.value)} className="pl-9" autoComplete="username" />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9" type="password" autoComplete="current-password" />
            </div>
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
            <span>Remember session</span>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-a2-green" />
          </label>
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            <LogIn className="h-4 w-4" />
            Enter A2 Panel
          </Button>
          <div className="rounded-md border border-a2-green/20 bg-a2-green/8 px-3 py-2 text-center text-sm text-zinc-300">
            Demo login: <span className="font-semibold text-a2-green">admin / admin</span>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
