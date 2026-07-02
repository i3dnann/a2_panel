import { BellRing, Download, ExternalLink, FileClock, ShieldAlert, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, ConfirmDialog, DataTable, Field, Input, Panel, Select, Textarea } from "../components/ui";
import { useToast } from "../contexts";
import { api, downloadApi } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { AuditLog, BanRecord, ReportRecord, RoleName, WarningRecord, VehicleRecord, AuthUser } from "../types";

export function BansPage() {
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ targetName: "", citizenId: "", license: "", discord: "", reason: "", permanent: true, hours: 24, evidence: "" });
  const { pushToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      setBans((await api<{ bans: BanRecord[] }>("/bans")).bans);
    } catch (error) {
      pushToast({ level: "error", title: "Bans failed", message: error instanceof Error ? error.message : "Could not load bans" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    const expiresAt = form.permanent ? null : new Date(Date.now() + Number(form.hours) * 3600000).toISOString();
    try {
      await api("/bans", {
        method: "POST",
        body: JSON.stringify({ ...form, expiresAt, hours: undefined })
      });
      setForm({ targetName: "", citizenId: "", license: "", discord: "", reason: "", permanent: true, hours: 24, evidence: "" });
      pushToast({ level: "success", title: "Ban created" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Ban failed", message: error instanceof Error ? error.message : "Could not create ban" });
    }
  }

  return (
    <div className="grid gap-5">
      <Panel title="Create Ban" eyebrow="Online or offline identifiers">
        <form className="grid gap-3 lg:grid-cols-4" onSubmit={create}>
          <Field label="Target name"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
          <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
          <Field label="License"><Input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></Field>
          <Field label="Discord ID"><Input value={form.discord} onChange={(event) => setForm({ ...form, discord: event.target.value })} /></Field>
          <Field label="Duration"><Select value={form.permanent ? "permanent" : "temporary"} onChange={(event) => setForm({ ...form, permanent: event.target.value === "permanent" })}><option value="permanent">Permanent</option><option value="temporary">Temporary</option></Select></Field>
          <Field label="Hours"><Input type="number" min={1} disabled={form.permanent} value={form.hours} onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} /></Field>
          <Field label="Evidence"><Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></Field>
          <Field label="Reason"><Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="lg:col-span-4"><Button type="submit" variant="danger" disabled={form.reason.length < 2}>Create Ban</Button></div>
        </form>
      </Panel>
      <Panel title="Ban Management" actions={<Button onClick={() => void downloadApi("/bans/export", "a2-panel-bans.csv")}><Download className="h-4 w-4" /> Export CSV</Button>}>
        <DataTable
          rows={bans as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No bans found."
          columns={[
            { key: "targetName", label: "Target", sortable: true },
            { key: "reason", label: "Reason" },
            { key: "staffName", label: "Staff", sortable: true },
            { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "expiresAt", label: "Expiry", render: (row) => (row.permanent ? "Permanent" : formatDate(row.expiresAt as string)) },
            { key: "active", label: "Status", render: (row) => <Badge tone={row.active ? "red" : "neutral"}>{row.active ? "Active" : "Inactive"}</Badge> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button disabled={!row.active} onClick={() => api(`/bans/${row.id}/unban`, { method: "POST" }).then(load)}>Unban</Button>
                  <ConfirmDialog title="Delete Ban Record" body="This deletes the ban record from A2 Panel. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/bans/${row.id}`, { method: "DELETE" }).then(load)}>
                    {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                  </ConfirmDialog>
                </div>
              )
            }
          ]}
        />
      </Panel>
    </div>
  );
}

export function WarningsPage() {
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [form, setForm] = useState({ targetName: "", citizenId: "", severity: "low" as WarningRecord["severity"], reason: "", evidence: "" });
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      setWarnings((await api<{ warnings: WarningRecord[] }>("/warnings")).warnings);
    } catch (error) {
      pushToast({ level: "error", title: "Warnings failed", message: error instanceof Error ? error.message : "Could not load warnings" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/warnings", { method: "POST", body: JSON.stringify(form) });
      setForm({ targetName: "", citizenId: "", severity: "low", reason: "", evidence: "" });
      pushToast({ level: "success", title: "Warning issued" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Warning failed", message: error instanceof Error ? error.message : "Could not issue warning" });
    }
  }

  return (
    <div className="grid gap-5">
      <Panel title="Issue Warning" eyebrow="Escalation aware">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={create}>
          <Field label="Target"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
          <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
          <Field label="Severity"><Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as WarningRecord["severity"] })}><option>low</option><option>medium</option><option>high</option><option>critical</option></Select></Field>
          <Field label="Evidence"><Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></Field>
          <Field label="Reason"><Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="md:col-span-5"><Button type="submit" variant="primary" disabled={form.reason.length < 2}>Issue Warning</Button></div>
        </form>
      </Panel>
      <Panel title="Warnings">
        <DataTable
          rows={warnings as unknown as Record<string, unknown>[]}
          loading={loading}
          columns={[
            { key: "targetName", label: "Target", sortable: true },
            { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "red" : row.severity === "high" ? "yellow" : "blue"}>{String(row.severity)}</Badge> },
            { key: "reason", label: "Reason" },
            { key: "staffName", label: "Staff" },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt as string) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <ConfirmDialog title="Remove Warning" body="Warning removal is logged. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/warnings/${row.id}`, { method: "DELETE" }).then(load)}>
                  {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                </ConfirmDialog>
              )
            }
          ]}
        />
      </Panel>
    </div>
  );
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setReports((await api<{ reports: ReportRecord[] }>(`/reports${status ? `?status=${status}` : ""}`)).reports);
    } catch (error) {
      pushToast({ level: "error", title: "Reports failed", message: error instanceof Error ? error.message : "Could not load reports" });
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function action(id: number, actionName: "claim" | "close", body?: Record<string, unknown>) {
    await api(`/reports/${id}/${actionName}`, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
    await load();
  }

  return (
    <div className="grid gap-5">
      <Panel title="Reports" eyebrow="/report from game" actions={<Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40"><option value="">All</option><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="closed">Closed</option></Select>}>
        <DataTable
          rows={reports as unknown as Record<string, unknown>[]}
          empty="No reports."
          columns={[
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "pending" ? "yellow" : row.status === "closed" ? "neutral" : "green"}>{String(row.status)}</Badge> },
            { key: "reporterName", label: "Reporter" },
            { key: "message", label: "Message" },
            { key: "assignedStaffName", label: "Assigned" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt as string) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={row.status !== "pending"} onClick={() => action(Number(row.id), "claim")}>Claim</Button>
                  <Button disabled={row.status === "closed"} onClick={() => action(Number(row.id), "close", { resolution: "Closed from A2 Panel" })}>Close</Button>
                  <Button onClick={() => api(`/reports/${row.id}/note`, { method: "POST", body: JSON.stringify({ note: note || "Reviewed in A2 Panel" }) }).then(load)}>Note</Button>
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Panel title="Internal Note Text">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note used by the Note action above" />
      </Panel>
    </div>
  );
}

export function StaffPage() {
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", roleName: "Support" as RoleName });
  const { pushToast } = useToast();

  async function load() {
    try {
      setStaff((await api<{ staff: AuthUser[] }>("/staff")).staff);
    } catch (error) {
      pushToast({ level: "error", title: "Staff failed", message: error instanceof Error ? error.message : "Could not load staff" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/staff", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", displayName: "", password: "", roleName: "Support" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Staff create failed", message: error instanceof Error ? error.message : "Could not create staff" });
    }
  }

  return (
    <div className="grid gap-5">
      <Panel title="Create Staff Account" eyebrow="Granular permissions">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={create}>
          <Field label="Username"><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></Field>
          <Field label="Display name"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
          <Field label="Password"><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
          <Field label="Role"><Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as RoleName })}>{["Owner", "Super Admin", "Admin", "Moderator", "Support", "Viewer"].map((role) => <option key={role}>{role}</option>)}</Select></Field>
          <div className="flex items-end"><Button type="submit" variant="primary" disabled={form.password.length < 8}>Create</Button></div>
        </form>
      </Panel>
      <Panel title="Staff Accounts">
        <DataTable
          rows={staff as unknown as Record<string, unknown>[]}
          columns={[
            { key: "username", label: "Username", sortable: true },
            { key: "displayName", label: "Name" },
            { key: "roleName", label: "Role", render: (row) => <Badge tone={row.roleName === "Owner" ? "green" : "blue"}>{String(row.roleName)}</Badge> },
            { key: "lastLoginAt", label: "Last login", render: (row) => formatDate(row.lastLoginAt as string) },
            { key: "disabled", label: "Status", render: (row) => <Badge tone={row.disabled ? "red" : "green"}>{row.disabled ? "Disabled" : "Active"}</Badge> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <Button onClick={() => api(`/staff/${row.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !row.disabled }) }).then(load)}>{row.disabled ? "Enable" : "Disable"}</Button>
                  <Button onClick={() => api(`/staff/${row.id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: "ChangeMe123!" }) }).then(load)}>Reset</Button>
                </div>
              )
            }
          ]}
        />
      </Panel>
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setLogs((await api<{ logs: AuditLog[] }>(`/logs?search=${encodeURIComponent(search)}`)).logs);
    } catch (error) {
      pushToast({ level: "error", title: "Logs failed", message: error instanceof Error ? error.message : "Could not load logs" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Panel title="Audit Logs" eyebrow="Everything sensitive is recorded" actions={<Button onClick={() => void downloadApi("/logs/export", "a2-panel-audit-logs.csv")}><Download className="h-4 w-4" /> Export CSV</Button>}>
      <div className="mb-3 flex gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by staff, target, action, reason" />
        <Button onClick={load}>Apply</Button>
      </div>
      <DataTable
        rows={logs as unknown as Record<string, unknown>[]}
        columns={[
          { key: "createdAt", label: "Time", sortable: true, render: (row) => formatDate(row.createdAt as string) },
          { key: "staffName", label: "Staff", sortable: true },
          { key: "actionType", label: "Action", sortable: true },
          { key: "targetPlayer", label: "Target" },
          { key: "reason", label: "Reason" },
          { key: "success", label: "Result", render: (row) => <Badge tone={row.success ? "green" : "red"}>{row.success ? "Success" : "Failed"}</Badge> }
        ]}
      />
    </Panel>
  );
}

export function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const { pushToast } = useToast();

  async function load(event?: FormEvent) {
    event?.preventDefault();
    try {
      setVehicles((await api<{ vehicles: VehicleRecord[] }>(`/vehicles?search=${encodeURIComponent(search)}`)).vehicles);
    } catch (error) {
      pushToast({ level: "error", title: "Vehicles failed", message: error instanceof Error ? error.message : "Could not search vehicles" });
    }
  }

  return (
    <div className="grid gap-5">
      <Panel title="Vehicle Management" eyebrow="Plate, owner, garage">
        <form className="flex gap-2" onSubmit={load}>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Plate, citizen ID, or model" />
          <Button type="submit" variant="primary">Search</Button>
        </form>
      </Panel>
      <Panel title="Vehicle Results">
        <DataTable rows={vehicles as unknown as Record<string, unknown>[]} columns={[
          { key: "plate", label: "Plate", sortable: true },
          { key: "vehicle", label: "Vehicle" },
          { key: "citizenId", label: "Owner" },
          { key: "garage", label: "Garage" },
          { key: "state", label: "State" }
        ]} empty="Search for a plate or owner to inspect vehicle records." />
      </Panel>
    </div>
  );
}

export function ConsolePage() {
  const [command, setCommand] = useState("status");
  const [history, setHistory] = useState<string[]>([]);
  const { pushToast } = useToast();

  async function sendCommand() {
    try {
      await api("/console/command", { method: "POST", body: JSON.stringify({ command }) });
      setHistory((current) => [command, ...current].slice(0, 12));
      pushToast({ level: "success", title: "Console command queued", message: "Only FiveM/RCON commands are sent, never VPS shell commands." });
    } catch (error) {
      pushToast({ level: "error", title: "Console failed", message: error instanceof Error ? error.message : "Could not send command" });
    }
  }

  return (
    <div className="grid gap-5">
      <Panel title="Server Console" eyebrow="FiveM commands only">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={(event) => event.preventDefault()}>
          <Input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="status, say hello, refresh, ensure resource" />
          <ConfirmDialog title="Send Console Command" body="This sends a FiveM server command through the bridge/RCON layer. It never runs shell commands on the VPS." phrase={command.startsWith("stop") ? "CONFIRM" : undefined} onConfirm={sendCommand}>
            {(open) => <Button type="button" variant="primary" onClick={open}>Send</Button>}
          </ConfirmDialog>
        </form>
      </Panel>
      <Panel title="Command History">
        <div className="grid gap-2">
          {history.map((item) => <code key={item} className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-300">{item}</code>)}
          {!history.length ? <p className="text-sm text-zinc-500">No commands sent this session.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

export function DiscordPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [webhooks, setWebhooks] = useState({ admin: "", bans: "", reports: "", errors: "" });
  const { pushToast } = useToast();

  useEffect(() => {
    void api<{ settings: Record<string, unknown> }>("/settings").then((response) => {
      setSettings(response.settings);
      const current = (response.settings.discordWebhooks ?? {}) as Record<string, string>;
      setWebhooks({ admin: current.admin ?? "", bans: current.bans ?? "", reports: current.reports ?? "", errors: current.errors ?? "" });
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, discordWebhooks: webhooks }) });
    pushToast({ level: "success", title: "Discord webhooks saved" });
  }

  return (
    <Panel title="Discord Integration" eyebrow="Webhooks and role mapping">
      <form className="grid gap-3" onSubmit={save}>
        {Object.entries(webhooks).map(([key, value]) => (
          <Field key={key} label={`${key} webhook`}>
            <Input value={value} onChange={(event) => setWebhooks({ ...webhooks, [key]: event.target.value })} placeholder="https://discord.com/api/webhooks/..." />
          </Field>
        ))}
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
          Discord bot tokens stay server-side only. This page stores webhook URLs through the backend settings endpoint.
        </div>
        <Button type="submit" variant="primary">Save Discord Settings</Button>
      </form>
    </Panel>
  );
}

export function LiveViewPage() {
  return (
    <div className="grid gap-5">
      <Panel title="Live View" eyebrow="Map and staff operations">
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="min-h-[520px] rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="grid h-full place-items-center rounded-md border border-dashed border-a2-green/20 text-center">
              <div>
                <ShieldAlert className="mx-auto h-10 w-10 text-a2-green" />
                <h2 className="mt-3 text-xl font-bold">Coordinate Live Map</h2>
                <p className="mt-2 max-w-md text-sm text-zinc-400">Connect `a2_panel_bridge` to stream coordinates. Screenshot previews require screenshot-basic or a compatible export.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {["Player cards", "Online staff", "Spectate hook", "Screenshot request", "Quick action drawer"].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">{item}</div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function AnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [style, setStyle] = useState("info");
  const [duration, setDuration] = useState(8000);
  const { pushToast } = useToast();

  async function send(event: FormEvent) {
    event.preventDefault();
    await api("/console/command", { method: "POST", body: JSON.stringify({ command: `a2announce ${style} ${duration} ${message}` }) });
    pushToast({ level: "success", title: "Announcement queued" });
    setMessage("");
  }

  return (
    <Panel title="Announcements" eyebrow="Server broadcast">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={send}>
        <Field label="Style"><Select value={style} onChange={(event) => setStyle(event.target.value)}><option>info</option><option>warning</option><option>success</option><option>danger</option></Select></Field>
        <Field label="Duration ms"><Input type="number" min={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
        <Field label="Message"><Input value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" disabled={!message}><BellRing className="h-4 w-4" /> Send</Button></div>
      </form>
    </Panel>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [modules, setModules] = useState<Record<string, string>>({});
  const { pushToast } = useToast();

  useEffect(() => {
    void api<{ settings: Record<string, unknown>; modules: Record<string, string> }>("/settings").then((response) => {
      setSettings(response.settings);
      setModules(response.modules);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/settings", { method: "PATCH", body: JSON.stringify(settings) });
    pushToast({ level: "success", title: "Settings saved" });
  }

  const moduleSettings = (settings.modules ?? {}) as Record<string, boolean>;

  return (
    <div className="grid gap-5">
      <Panel title="A2 Panel Settings" eyebrow="Server, bridge, modules">
        <form className="grid gap-3 lg:grid-cols-3" onSubmit={save}>
          <Field label="Server name"><Input value={String(settings.serverName ?? "")} onChange={(event) => setSettings({ ...settings, serverName: event.target.value })} /></Field>
          <Field label="Backend public URL"><Input value={String(settings.backendPublicUrl ?? "")} onChange={(event) => setSettings({ ...settings, backendPublicUrl: event.target.value })} /></Field>
          <Field label="FiveM IP"><Input value={String(settings.fivemServerIp ?? "")} onChange={(event) => setSettings({ ...settings, fivemServerIp: event.target.value })} /></Field>
          <Field label="FiveM port"><Input value={String(settings.fivemServerPort ?? "")} onChange={(event) => setSettings({ ...settings, fivemServerPort: Number(event.target.value) })} /></Field>
          <Field label="Framework"><Select value={String(settings.frameworkMode ?? "qbcore")} onChange={(event) => setSettings({ ...settings, frameworkMode: event.target.value })}><option value="qbcore">qbcore</option><option value="esx">esx</option><option value="qbox">qbox</option><option value="custom">custom</option></Select></Field>
          <Field label="Accent color"><Input value={String(settings.accentColor ?? "#b7fe1a")} onChange={(event) => setSettings({ ...settings, accentColor: event.target.value })} /></Field>
          <div className="lg:col-span-3">
            <Button type="submit" variant="primary">Save Settings</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Module Toggles">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(moduleSettings).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="capitalize text-zinc-300">{key.replace(/([A-Z])/g, " $1")}</span>
              <input type="checkbox" checked={value} onChange={(event) => setSettings({ ...settings, modules: { ...moduleSettings, [key]: event.target.checked } })} className="h-4 w-4 accent-a2-green" />
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Detected Database Modules">
        <div className="grid gap-2 md:grid-cols-3">
          {Object.entries(modules).map(([key, value]) => <Badge key={key} tone={value === "ok" ? "green" : value === "missing" ? "red" : "yellow"}>{key}: {value}</Badge>)}
        </div>
      </Panel>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <Panel title="Unauthorized" eyebrow="A2 Panel">
      <p className="text-zinc-400">Your staff role does not have permission for this action.</p>
    </Panel>
  );
}

export function NotFoundPage() {
  return (
    <Panel title="Page Not Found" eyebrow="A2 Panel 404">
      <p className="text-zinc-400">That A2 Panel route does not exist.</p>
    </Panel>
  );
}
