import { motion } from "framer-motion";
import { CheckCircle2, Lock, LogIn, User, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, useToast } from "../contexts";
import { Button, Input } from "../components/ui";
import { api, setToken } from "../lib/api";

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
      await new Promise((resolve) => window.setTimeout(resolve, 420));
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
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#060708] px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 a2-aurora opacity-90" />
      <div className="pointer-events-none absolute inset-0 a2-grid-bg opacity-45" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(183,254,26,0.16),transparent_32rem)]" />

      <motion.form
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={loginState === "failed" ? { opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -6, 6, 0] } : { opacity: 1, y: 0, scale: 1, x: 0 }}
        transition={{ duration: loginState === "failed" ? 0.36 : 0.55, ease: "easeOut" }}
        className="a2-glass relative z-10 grid w-full max-w-[420px] gap-5 rounded-md p-7 shadow-panel"
        onSubmit={submit}
      >
        <div className="text-center">
          <motion.div
            animate={{ boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 34px rgba(183,254,26,0.28)", "0 0 0 rgba(183,254,26,0)"] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-md border border-a2-green/35 bg-a2-green/12 text-a2-green"
          >
            <img src="/assets/a2-logo.png" alt="" className="h-full w-full object-cover" />
          </motion.div>
          <h1 className="mt-4 text-2xl font-bold">A2 Panel</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back</p>
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
    </div>
  );
}
