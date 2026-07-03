import { motion } from "framer-motion";
import { CheckCircle2, Lock, LogIn, User, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { useAuth, useToast } from "../contexts";
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
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");
    const params = new URLSearchParams(window.location.search);
    const discordError = params.get("discord_error");
    if (token) {
      setToken(token);
      window.history.replaceState({}, "", "/dashboard");
      window.location.replace("/dashboard");
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
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050607] px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 animated-bg opacity-45" />
      <div className="pointer-events-none absolute inset-0 landing-grid opacity-55" />
      <div className="pointer-events-none absolute inset-0 a2-aurora opacity-75" />

      <div className="relative z-10 grid w-full max-w-[440px] gap-5">
        <Link to="/" className="mx-auto flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0c0e]/80 px-4 py-3 backdrop-blur-xl">
          <img src="/assets/a2-logo.png" alt="" className="h-10 w-10 rounded-lg border border-a2-green/30 object-cover shadow-glow" />
          <div>
            <p className="font-black">A2 Panel</p>
            <p className="text-xs text-zinc-500">FiveM staff control system</p>
          </div>
        </Link>

        <motion.form
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={loginState === "failed" ? { opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -6, 6, 0] } : { opacity: 1, y: 0, scale: 1, x: 0 }}
          transition={{ duration: loginState === "failed" ? 0.36 : 0.55, ease: "easeOut" }}
          className="a2-glass grid gap-5 rounded-2xl p-6 shadow-panel"
          onSubmit={submit}
        >
          <div>
            <h1 className="text-3xl font-black">Staff Login</h1>
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
        </motion.form>

        <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
          <Link className="hover:text-a2-green" to="/">Home</Link>
          <Link className="hover:text-a2-green" to="/demo">Try Demo</Link>
        </div>
      </div>
    </div>
  );
}
