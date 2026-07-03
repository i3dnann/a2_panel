import { BellRing, Car, ClipboardList, Download, Eye, Gavel, History, MapPin, MessageSquareWarning, Plus, RefreshCw, Search, Settings, Trash2, Unlock, UserCog, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge, Button, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Panel, Select, Textarea } from "../components/ui";
import { useA2Socket, useAuth, useToast } from "../contexts";
import { api, downloadApi } from "../lib/api";
import { clsx, formatDate, formatNumber } from "../lib/format";
import type { AuditLog, BanRecord, ReportRecord, RoleName, WarningRecord, VehicleRecord, AuthUser, OnlinePlayer, Permission } from "../types";

const allPermissions: Permission[] = [
  "dashboard.view", "players.view", "players.kick", "players.ban", "players.warn", "players.revive", "players.heal",
  "players.armor", "players.needs", "players.jail", "players.clothing", "players.teleport", "players.screenshot",
  "players.inventory.view", "players.inventory.edit", "players.money.view", "players.money.edit", "players.job.edit",
  "players.gang.edit", "bans.view", "bans.create", "bans.delete", "reports.view", "reports.claim", "reports.close", "reports.delete",
  "staff.view", "staff.create", "staff.edit", "staff.delete", "settings.view", "settings.edit", "logs.view", "database.write",
  "announcements.txadmin", "screenshots.view"
];
const staffRoles: RoleName[] = ["Founder", "Owner", "Ban Team", "Super Admin", "Admin", "Moderator", "Support", "Viewer"];

export function BansPage() {
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [lookup, setLookup] = useState("");
  const [form, setForm] = useState({ targetName: "", citizenId: "", license: "", discord: "", steam: "", fivem: "", ip: "", hwid: "", reason: "", permanent: true, hours: 24, evidence: "" });
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
      setForm({ targetName: "", citizenId: "", license: "", discord: "", steam: "", fivem: "", ip: "", hwid: "", reason: "", permanent: true, hours: 24, evidence: "" });
      setNewOpen(false);
      pushToast({ level: "success", title: "Ban created" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Ban failed", message: error instanceof Error ? error.message : "Could not create ban" });
    }
  }

  async function autofill() {
    if (!lookup.trim()) return;
    try {
      const response = await api<{ online?: OnlinePlayer | null; offline?: Record<string, unknown> | null; identifiers?: Record<string, string | null> }>(`/players/resolve?q=${encodeURIComponent(lookup.trim())}`);
      const player = response.online ?? response.offline ?? {};
      setForm((current) => ({
        ...current,
        targetName: String((player as Record<string, unknown>).characterName ?? current.targetName ?? ""),
        citizenId: String((player as Record<string, unknown>).citizenId ?? current.citizenId ?? ""),
        license: response.identifiers?.license ?? String((player as Record<string, unknown>).license ?? current.license ?? ""),
        discord: response.identifiers?.discord ?? response.identifiers?.discordId ?? String((player as Record<string, unknown>).discordId ?? current.discord ?? ""),
        steam: response.identifiers?.steam ?? String((player as Record<string, unknown>).steam ?? current.steam ?? ""),
        fivem: response.identifiers?.fivem ?? String((player as Record<string, unknown>).fivem ?? current.fivem ?? ""),
        ip: response.identifiers?.ip ?? String((player as Record<string, unknown>).ip ?? current.ip ?? ""),
        hwid: response.identifiers?.hwid ?? current.hwid
      }));
      pushToast({ level: "success", title: "Player info filled" });
    } catch (error) {
      pushToast({ level: "error", title: "Lookup failed", message: error instanceof Error ? error.message : "Could not resolve player" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Bans"
        description={`${bans.filter((ban) => ban.active).length} active bans`}
        icon={<Gavel className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New Ban</Button>}
      />
      <Panel>
        <DataTable
          rows={bans as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No bans found."
          searchPlaceholder="Search bans..."
          actions={<Button onClick={() => void downloadApi("/bans/export", "a2-panel-bans.csv")}><Download className="h-4 w-4" /> Export CSV</Button>}
          columns={[
            { key: "targetName", label: "Player", sortable: true, render: (row) => <span className="font-semibold text-white">{String(row.targetName)}</span> },
            { key: "reason", label: "Reason" },
            { key: "permanent", label: "Type", render: (row) => <Badge tone={row.permanent ? "red" : "yellow"}>{row.permanent ? "Permanent" : "Temporary"}</Badge> },
            { key: "active", label: "Status", render: (row) => <Badge tone={row.active ? "red" : "neutral"}>{row.active ? "Active" : "Expired"}</Badge> },
            { key: "staffName", label: "Banned By", sortable: true },
            { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "expiresAt", label: "Expires", render: (row) => (row.permanent ? "Never" : formatDate(row.expiresAt as string)) },
            {
              key: "actions",
              label: "Action",
              render: (row) => (
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button disabled={!row.active} onClick={() => api(`/bans/${row.id}/unban`, { method: "POST" }).then(load)}><Unlock className="h-4 w-4" /> Unban</Button>
                  <ConfirmDialog title="Delete Ban Record" body="This deletes the ban record from A2 Panel. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/bans/${row.id}`, { method: "DELETE" }).then(load)}>
                    {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                  </ConfirmDialog>
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Modal open={newOpen} title="Create Ban" onClose={() => setNewOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Auto-fill by server ID, Discord, Steam, license, IP, or citizen ID" />
            <Button type="button" variant="secondary" onClick={autofill}>Auto Fill</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Target name"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
            <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
            <Field label="License"><Input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></Field>
            <Field label="Discord ID"><Input value={form.discord} onChange={(event) => setForm({ ...form, discord: event.target.value })} /></Field>
            <Field label="Steam"><Input value={form.steam} onChange={(event) => setForm({ ...form, steam: event.target.value })} /></Field>
            <Field label="FiveM"><Input value={form.fivem} onChange={(event) => setForm({ ...form, fivem: event.target.value })} /></Field>
            <Field label="IP"><Input value={form.ip} onChange={(event) => setForm({ ...form, ip: event.target.value })} /></Field>
            <Field label="HWID token"><Input value={form.hwid} onChange={(event) => setForm({ ...form, hwid: event.target.value })} /></Field>
            <Field label="Duration"><Select value={form.permanent ? "permanent" : "temporary"} onChange={(event) => setForm({ ...form, permanent: event.target.value === "permanent" })}><option value="permanent">Permanent</option><option value="temporary">Temporary</option></Select></Field>
            <Field label="Hours"><Input type="number" min={1} disabled={form.permanent} value={form.hours} onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} /></Field>
          </div>
          <Field label="Evidence"><Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} placeholder="Clip, screenshot, or case URL" /></Field>
          <Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={form.reason.length < 2}>Create Ban</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function WarningsPage() {
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [form, setForm] = useState({ targetName: "", citizenId: "", severity: "low" as WarningRecord["severity"], reason: "", evidence: "" });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
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
      setCreateOpen(false);
      pushToast({ level: "success", title: "Warning issued" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Warning failed", message: error instanceof Error ? error.message : "Could not issue warning" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Warnings"
        description={`${warnings.length} warnings`}
        icon={<MessageSquareWarning className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Warning</Button>}
      />
      <Panel>
        <DataTable
          rows={warnings as unknown as Record<string, unknown>[]}
          loading={loading}
          searchPlaceholder="Search warnings..."
          columns={[
            { key: "targetName", label: "Player", sortable: true, render: (row) => <span className="font-semibold text-white">{String(row.targetName)}</span> },
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
      <Modal open={createOpen} title="Issue Warning" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <Field label="Target"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
          <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
          <Field label="Severity"><Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as WarningRecord["severity"] })}><option>low</option><option>medium</option><option>high</option><option>critical</option></Select></Field>
          <Field label="Evidence"><Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></Field>
          <Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={form.reason.length < 2}>Issue Warning</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const { pushToast } = useToast();
  const canDeleteReports = user?.roleName === "Founder" || user?.roleName === "Owner";

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
      <PageHeader
        title="Reports"
        description={`${reports.length} total reports`}
        icon={<ClipboardList className="h-6 w-6" />}
        actions={<Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40"><option value="">All</option><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="closed">Closed</option></Select>}
      />
      <Panel>
        <DataTable
          rows={reports as unknown as Record<string, unknown>[]}
          empty="No reports."
          searchPlaceholder="Search reports..."
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
                  <Button disabled={!note.trim()} onClick={() => api(`/reports/${row.id}/reply`, { method: "POST", body: JSON.stringify({ message: note }) }).then(load)}>Reply</Button>
                  {canDeleteReports ? (
                    <ConfirmDialog title="Delete Report" body="This deletes the report from A2 Panel history. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/reports/${row.id}`, { method: "DELETE" }).then(load)}>
                      {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                    </ConfirmDialog>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Panel title="Reply / Internal Note Text">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a staff note or a reply to send back to the reporter" />
      </Panel>
    </div>
  );
}

export function StaffPage() {
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support" as RoleName, permissions: ["dashboard.view", "players.view", "reports.view"] as Permission[] });
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
      await api("/staff", { method: "POST", body: JSON.stringify({ ...form, password: form.password || undefined }) });
      setForm({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support", permissions: ["dashboard.view", "players.view", "reports.view"] });
      setCreateOpen(false);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Staff create failed", message: error instanceof Error ? error.message : "Could not create staff" });
    }
  }

  async function updateStaff(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await api(`/staff/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email || null,
          discordId: form.discordId || null,
          roleName: form.roleName,
          permissions: form.permissions
        })
      });
      setEditing(null);
      await load();
      pushToast({ level: "success", title: "Staff updated" });
    } catch (error) {
      pushToast({ level: "error", title: "Staff update failed", message: error instanceof Error ? error.message : "Could not update staff" });
    }
  }

  function togglePermission(permission: Permission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  function openEdit(row: Record<string, unknown>) {
    const account = row as unknown as AuthUser;
    setEditing(account);
    setForm({
      username: account.username,
      displayName: account.displayName,
      email: account.email ?? "",
      discordId: account.discordId ?? "",
      password: "",
      roleName: account.roleName,
      permissions: account.permissions
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support", permissions: ["dashboard.view", "players.view", "reports.view"] });
    setCreateOpen(true);
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Staff"
        description={`${staff.length} staff members`}
        icon={<UserCog className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={openCreate}><UserPlus className="h-4 w-4" /> Add Staff</Button>}
      />
      <Panel>
        <DataTable
          rows={staff as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search staff..."
          columns={[
            {
              key: "displayName",
              label: "Name",
              sortable: true,
              render: (row) => (
                <div>
                  <p className="font-semibold text-white">{String(row.displayName || row.username)}</p>
                  <p className="text-xs text-zinc-600">{String(row.email || row.discordId ? `${row.email ?? ""} ${row.discordId ? `Discord ${row.discordId}` : ""}` : row.username)}</p>
                </div>
              )
            },
            { key: "roleName", label: "Role", render: (row) => <Badge tone={row.roleName === "Owner" || row.roleName === "Founder" ? "red" : row.roleName === "Ban Team" ? "yellow" : "blue"}>{String(row.roleName)}</Badge> },
            { key: "disabled", label: "Status", render: (row) => <Badge tone={row.disabled ? "red" : "green"}>{row.disabled ? "Disabled" : "Active"}</Badge> },
            { key: "lastLoginAt", label: "Last Login", render: (row) => formatDate(row.lastLoginAt as string) },
            { key: "loginCount", label: "Logins", render: (row) => (row.lastLoginAt ? "1+" : "0") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(row)}>Edit</Button>
                  <Button onClick={() => api(`/staff/${row.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !row.disabled }) }).then(load)}>{row.disabled ? "Enable" : "Disable"}</Button>
                  <Button onClick={() => api(`/staff/${row.id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: "ChangeMe123!" }) }).then(load)}>Reset</Button>
                  <ConfirmDialog title="Delete Staff" body="This removes panel access for this staff account. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/staff/${row.id}`, { method: "DELETE" }).then(load)}>
                    {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                  </ConfirmDialog>
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Modal open={createOpen} title="Add Staff" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <Field label="Username"><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Optional if Discord ID is set" /></Field>
          <Field label="Display name"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="owner@example.com" /></Field>
          <Field label="Discord ID"><Input value={form.discordId} onChange={(event) => setForm({ ...form, discordId: event.target.value.replace(/^discord:/, "") })} placeholder="123456789012345678" /></Field>
          <Field label="Password"><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Optional for Discord-only login" /></Field>
          <Field label="Role"><Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as RoleName })}>{staffRoles.map((role) => <option key={role}>{role}</option>)}</Select></Field>
          <PermissionPicker selected={form.permissions} onToggle={togglePermission} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!form.discordId && form.password.length < 8}>Create Staff</Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit Staff" onClose={() => setEditing(null)}>
        <form className="grid gap-3" onSubmit={updateStaff}>
          <Field label="Display name"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Discord ID"><Input value={form.discordId} onChange={(event) => setForm({ ...form, discordId: event.target.value.replace(/^discord:/, "") })} /></Field>
          <Field label="Role"><Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as RoleName })}>{staffRoles.map((role) => <option key={role}>{role}</option>)}</Select></Field>
          <PermissionPicker selected={form.permissions} onToggle={togglePermission} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Staff</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PermissionPicker({ selected, onToggle }: { selected: Permission[]; onToggle: (permission: Permission) => void }) {
  return (
    <div className="rounded-md border border-[#1d242a] bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Permissions</p>
        <p className="text-xs text-zinc-500">{selected.length} selected</p>
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {allPermissions.map((permission) => (
          <label key={permission} className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.025] px-2 py-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={selected.includes(permission)} onChange={() => onToggle(permission)} className="h-4 w-4 accent-a2-green" />
            <span>{permission}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const { pushToast } = useToast();
  const actionTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.actionType))).filter(Boolean).slice(0, 20), [logs]);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (actionType) params.set("actionType", actionType);
      setLogs((await api<{ logs: AuditLog[] }>(`/logs${params.toString() ? `?${params.toString()}` : ""}`)).logs);
    } catch (error) {
      pushToast({ level: "error", title: "Logs failed", message: error instanceof Error ? error.message : "Could not load logs" });
    }
  }

  useEffect(() => {
    void load();
  }, [actionType]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Audit Logs"
        description={`${logs.length} total entries`}
        icon={<History className="h-6 w-6" />}
        actions={
          <>
            <Select value={actionType} onChange={(event) => setActionType(event.target.value)} className="!w-44 shrink-0">
              <option value="">All Actions</option>
              {actionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Button onClick={() => void downloadApi("/logs/export", "a2-panel-audit-logs.csv")}><Download className="h-4 w-4" /> Export CSV</Button>
          </>
        }
      />
      <Panel>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search logs..." className="pl-9" />
          </div>
          <Button onClick={load}>Apply</Button>
        </div>
        <DataTable
          rows={logs as unknown as Record<string, unknown>[]}
          hideSearch
          columns={[
            { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "staffName", label: "Staff", sortable: true },
            { key: "actionType", label: "Action", sortable: true, render: (row) => <span className="font-semibold text-a2-green">{String(row.actionType)}</span> },
            { key: "targetPlayer", label: "Target" },
            { key: "reason", label: "Reason", render: (row) => <LogReason row={row} /> },
            { key: "success", label: "Result", render: (row) => <Badge tone={row.success ? "green" : "red"}>{row.success ? "Success" : "Failed"}</Badge> }
          ]}
        />
      </Panel>
    </div>
  );
}

function LogReason({ row }: { row: Record<string, unknown> }) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const action = String(row.actionType ?? "");
  const red = action.includes(".remove") || action.includes(".delete");
  const green = action.includes(".give") || action.includes(".add");
  const details = [
    metadata.item ? `item ${metadata.item}` : null,
    metadata.amount != null ? `x${metadata.amount}` : null,
    metadata.account ? `account ${metadata.account}` : null,
    metadata.mode ? `mode ${metadata.mode}` : null,
    metadata.vehicle ? `vehicle ${metadata.vehicle}` : null,
    metadata.plate ? `plate ${metadata.plate}` : null,
    metadata.newPlate ? `${metadata.oldPlate ?? ""} -> ${metadata.newPlate}` : null
  ].filter(Boolean);
  return (
    <div className="grid gap-1">
      <span>{String(row.reason ?? "No reason")}</span>
      {details.length ? <span className={clsx("text-xs font-semibold", red ? "text-red-300" : green ? "text-a2-green" : "text-zinc-500")}>{details.join(" - ")}</span> : null}
    </div>
  );
}

export function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [giveForm, setGiveForm] = useState({ citizenId: "", vehicle: "sultan", plate: "", garage: "pillbox" });
  const [plateForm, setPlateForm] = useState({ oldPlate: "", newPlate: "" });
  const { pushToast } = useToast();

  async function load(event?: FormEvent) {
    event?.preventDefault();
    try {
      setVehicles((await api<{ vehicles: VehicleRecord[] }>(`/vehicles?search=${encodeURIComponent(search)}`)).vehicles);
    } catch (error) {
      pushToast({ level: "error", title: "Vehicles failed", message: error instanceof Error ? error.message : "Could not search vehicles" });
    }
  }

  async function giveVehicle(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/vehicles/give", { method: "POST", body: JSON.stringify(giveForm) });
      pushToast({ level: "success", title: "Vehicle given" });
      setSearch(giveForm.citizenId);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Give vehicle failed", message: error instanceof Error ? error.message : "Could not give vehicle" });
    }
  }

  async function changePlate(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/vehicles/plate", { method: "PATCH", body: JSON.stringify(plateForm) });
      pushToast({ level: "success", title: "Plate changed" });
      setSearch(plateForm.newPlate);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Plate change failed", message: error instanceof Error ? error.message : "Could not change plate" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Garage data"
        title="Vehicle Management"
        description="Search plates, owners, garage states, and vehicle metadata from configured QBCore or ESX tables."
        icon={<Car className="h-6 w-6" />}
      />
      <Panel title="Vehicle Management" eyebrow="Plate, owner, garage">
        <form className="flex gap-2" onSubmit={load}>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Plate, citizen ID, or model" />
          <Button type="submit" variant="primary">Search</Button>
        </form>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Give Vehicle" eyebrow="QBCore garage">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={giveVehicle}>
            <Field label="Citizen ID"><Input value={giveForm.citizenId} onChange={(event) => setGiveForm({ ...giveForm, citizenId: event.target.value })} required /></Field>
            <Field label="Vehicle model"><Input value={giveForm.vehicle} onChange={(event) => setGiveForm({ ...giveForm, vehicle: event.target.value })} required /></Field>
            <Field label="Plate"><Input value={giveForm.plate} onChange={(event) => setGiveForm({ ...giveForm, plate: event.target.value.toUpperCase() })} placeholder="Auto if empty" /></Field>
            <Field label="Garage"><Input value={giveForm.garage} onChange={(event) => setGiveForm({ ...giveForm, garage: event.target.value })} /></Field>
            <div className="md:col-span-2"><Button type="submit" variant="primary"><Plus className="h-4 w-4" /> Give Vehicle</Button></div>
          </form>
        </Panel>
        <Panel title="Change Plate" eyebrow="Owned vehicle">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={changePlate}>
            <Field label="Old plate"><Input value={plateForm.oldPlate} onChange={(event) => setPlateForm({ ...plateForm, oldPlate: event.target.value.toUpperCase() })} required /></Field>
            <Field label="New plate"><Input value={plateForm.newPlate} onChange={(event) => setPlateForm({ ...plateForm, newPlate: event.target.value.toUpperCase() })} required /></Field>
            <div className="md:col-span-2"><Button type="submit" variant="secondary">Change Plate</Button></div>
          </form>
        </Panel>
      </div>
      <Panel title="Vehicle Results">
        <DataTable rows={vehicles as unknown as Record<string, unknown>[]} columns={[
          { key: "plate", label: "Plate", sortable: true },
          { key: "vehicle", label: "Vehicle" },
          { key: "ownerName", label: "Owner", render: (row) => String(row.ownerName ?? row.citizenId ?? "n/a") },
          { key: "citizenId", label: "Citizen ID" },
          { key: "garage", label: "Garage" },
          { key: "state", label: "State" }
        ]} empty="Search for a plate or owner to inspect vehicle records." />
      </Panel>
    </div>
  );
}

export function DiscordPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [webhooks, setWebhooks] = useState({ admin: "", bans: "", reports: "", errors: "", inventory: "", money: "", vehicles: "", staff: "", warnings: "", characters: "" });
  const [status, setStatus] = useState<{ configured: boolean; missing: string[]; redirectUri?: string; frontendUrl?: string } | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    void api<{ settings: Record<string, unknown> }>("/settings").then((response) => {
      setSettings(response.settings);
      const current = (response.settings.discordWebhooks ?? {}) as Record<string, string>;
      setWebhooks({
        admin: current.admin ?? "",
        bans: current.bans ?? "",
        reports: current.reports ?? "",
        errors: current.errors ?? "",
        inventory: current.inventory ?? "",
        money: current.money ?? "",
        vehicles: current.vehicles ?? "",
        staff: current.staff ?? "",
        warnings: current.warnings ?? "",
        characters: current.characters ?? ""
      });
    });
    void api<{ configured: boolean; missing: string[]; redirectUri?: string; frontendUrl?: string }>("/auth/discord/status").then(setStatus).catch(() => undefined);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, discordWebhooks: webhooks }) });
    pushToast({ level: "success", title: "Discord webhooks saved" });
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Webhooks"
        title="Discord Integration"
        description="Route bans, reports, admin actions, joins, leaves, and errors to Discord without exposing tokens to the frontend."
        icon={<BellRing className="h-6 w-6" />}
      />
      <Panel title="Discord Integration" eyebrow="Webhooks and role mapping">
      <form className="grid gap-3" onSubmit={save}>
        {Object.entries(webhooks).map(([key, value]) => (
          <Field key={key} label={`${key} webhook`}>
            <Input value={value} onChange={(event) => setWebhooks({ ...webhooks, [key]: event.target.value })} placeholder="https://discord.com/api/webhooks/..." />
          </Field>
        ))}
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
          OAuth status: <span className={status?.configured ? "text-a2-green" : "text-red-200"}>{status?.configured ? "configured" : `missing ${status?.missing.join(", ") || "settings"}`}</span>
          <br />
          Redirect URI: <span className="break-all text-zinc-300">{status?.redirectUri ?? "not set"}</span>
        </div>
        <Button type="submit" variant="primary">Save Discord Settings</Button>
      </form>
      </Panel>
    </div>
  );
}

function mapPosition(coords: OnlinePlayer["coords"]) {
  if (!coords) return null;
  const minX = -4100;
  const maxX = 4500;
  const minY = -4200;
  const maxY = 8200;
  const left = ((coords.x - minX) / (maxX - minX)) * 100;
  const top = ((maxY - coords.y) / (maxY - minY)) * 100;
  return {
    left: `${Math.min(100, Math.max(0, left))}%`,
    top: `${Math.min(100, Math.max(0, top))}%`
  };
}

export function LiveViewPage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const socket = useA2Socket();
  const { pushToast } = useToast();

  async function load() {
    try {
      const response = await api<{ players: OnlinePlayer[]; bridgeOnline: boolean }>("/players/online");
      setPlayers(response.players);
      setBridgeOnline(response.bridgeOnline);
      setSelectedId((current) => current ?? response.players[0]?.serverId ?? null);
    } catch (error) {
      pushToast({ level: "error", title: "Live view failed", message: error instanceof Error ? error.message : "Could not load live view" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const update = (incoming: OnlinePlayer[]) => {
      setPlayers(incoming);
      setBridgeOnline(true);
      setSelectedId((current) => current ?? incoming[0]?.serverId ?? null);
    };
    socket.on("players.updated", update);
    return () => {
      socket.off("players.updated", update);
    };
  }, [socket]);

  const selected = players.find((player) => player.serverId === selectedId) ?? players[0] ?? null;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Live View"
        description="Real-time server overview"
        icon={<Eye className="h-6 w-6" />}
        actions={<Button onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title={`Online Players (${players.length})`} eyebrow={bridgeOnline ? "Bridge connected" : "Bridge offline"}>
          <div className="grid max-h-[620px] gap-2 overflow-y-auto pr-1">
            {players.map((player, index) => (
              <button
                key={player.serverId}
                type="button"
                onClick={() => setSelectedId(player.serverId)}
                className={clsx(
                  "flex items-center gap-3 rounded-md border px-3 py-3 text-left transition",
                  selected?.serverId === player.serverId ? "border-a2-green/35 bg-a2-green/[0.08]" : "border-transparent bg-white/[0.025] hover:border-white/10"
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-a2-green text-sm font-bold text-black">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{player.characterName}</span>
                  <span className="block truncate text-xs text-zinc-600">#{player.serverId} {player.job ? `- ${player.job}` : ""}</span>
                </span>
                <span className="a2-mono text-xs text-zinc-500">{formatNumber(player.ping ?? 0)}ms</span>
              </button>
            ))}
            {!players.length ? <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">No live players yet. Start the bridge to stream online players.</div> : null}
          </div>
        </Panel>
        <Panel title="Live Map" eyebrow={selected ? `${selected.characterName} selected` : "Waiting for player stream"}>
          <div className="grid min-h-[560px] gap-4 xl:grid-cols-[1fr_260px]">
            <div className="relative min-h-[560px] overflow-hidden rounded-md border border-[#1d242a] bg-[#050607]">
              <img src="/assets/a2-map.jpg" alt="" className="absolute inset-0 h-full w-full object-contain opacity-90" />
              {players.filter((player) => player.coords).map((player) => {
                const pos = mapPosition(player.coords);
                if (!pos) return null;
                const active = selected?.serverId === player.serverId;
                return (
                  <button
                    key={player.serverId}
                    type="button"
                    onClick={() => setSelectedId(player.serverId)}
                    style={pos}
                    className={clsx(
                      "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[11px] font-black shadow-panel transition hover:scale-110",
                      active ? "border-a2-green bg-a2-green text-black shadow-glow" : "border-white/30 bg-black/70 text-white"
                    )}
                    title={`${player.characterName} (${player.coords?.x.toFixed(0)}, ${player.coords?.y.toFixed(0)})`}
                  >
                    {player.serverId}
                  </button>
                );
              })}
              {!players.some((player) => player.coords) ? (
                <div className="absolute inset-0 grid place-items-center bg-black/35">
                  <div className="max-w-sm rounded-md border border-a2-green/20 bg-black/70 px-4 py-3 text-center shadow-panel">
                    <MapPin className="mx-auto h-8 w-8 text-a2-green" />
                    <p className="mt-2 font-semibold text-white">Waiting for bridge coordinates</p>
                    <p className="mt-1 text-sm text-zinc-500">Markers appear when `a2_panel_bridge` streams player positions.</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid content-start gap-2">
              <div className="rounded-md border border-[#1d242a] bg-black/20 p-3">
                <p className="text-sm font-semibold text-white">Selected Player</p>
                <p className="mt-1 text-sm text-zinc-500">{selected?.characterName ?? "None"}</p>
              </div>
              {players.slice(0, 8).map((player) => (
                <button
                  key={player.serverId}
                  type="button"
                  onClick={() => setSelectedId(player.serverId)}
                  className="flex items-center justify-between rounded-md border border-[#1d242a] bg-white/[0.025] px-3 py-2 text-left text-xs text-zinc-400 hover:border-a2-green/25"
                >
                  <span className="truncate">{player.characterName}</span>
                  <span className="a2-mono text-zinc-600">
                    {player.coords ? `${player.coords.x.toFixed(0)}, ${player.coords.y.toFixed(0)}` : "no coords"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>
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
    await api("/announcements/txadmin", { method: "POST", body: JSON.stringify({ style, duration, message }) });
    pushToast({ level: "success", title: "Announcement queued" });
    setMessage("");
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Broadcast"
        title="Announcements"
        description="Send styled server-wide announcements or targeted messages through the FiveM bridge."
        icon={<BellRing className="h-6 w-6" />}
      />
      <Panel title="Announcements" eyebrow="Server broadcast">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={send}>
        <Field label="Style"><Select value={style} onChange={(event) => setStyle(event.target.value)}><option>info</option><option>warning</option><option>success</option><option>danger</option></Select></Field>
        <Field label="Duration ms"><Input type="number" min={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
        <Field label="Message"><Input value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" disabled={!message}><BellRing className="h-4 w-4" /> Send</Button></div>
      </form>
      </Panel>
    </div>
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
      <PageHeader
        eyebrow="Configuration"
        title="A2 Panel Settings"
        description="Manage server identity, framework mode, module toggles, bridge settings, theme values, and table detection."
        icon={<Settings className="h-6 w-6" />}
      />
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
